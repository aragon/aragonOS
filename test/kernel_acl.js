const { assertRevert } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const { getBlockNumber } = require('./helpers/web3')

const getSig = x => web3.sha3(x).slice(0, 10)

contract('Kernel ACL', accounts => {
    let kernel, app = {}

    const permissionsRoot = accounts[0]
    const granted = accounts[1]
    const child = accounts[2]

    let role = null

    beforeEach(async () => {
        const kernelImpl = await Kernel.new()
        const kernelProxy = await KernelProxy.new(kernelImpl.address)
        kernel = Kernel.at(kernelProxy.address)
        app = kernel.address
        await kernel.initialize(permissionsRoot)
        role = await kernel.UPGRADE_KERNEL_ROLE()
    })

    it('has correct initialization block', async () => {
        assert.equal(await kernel.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
    })

    it('throws on reinitialization', async () => {
        return assertRevert(async () => {
            await kernel.initialize(accounts[0])
        })
    })

    it('actions cannot be performed by default', async () => {
        assert.isFalse(await kernel.canPerform(permissionsRoot, app, role))
    })

    it('protected actions fail if not allowed', async () => {
        return assertRevert(async () => {
            await kernel.upgradeKernel(accounts[0])
        })
    })

    it('create permission action can be performed by root by default', async () => {
        const createPermissionRole = await kernel.CREATE_PERMISSIONS_ROLE()
        assert.isTrue(await kernel.canPerform(permissionsRoot, kernel.address, createPermissionRole))
    })

    context('creating permission', () => {
        beforeEach(async () => {
            await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
        })

        it('returns created permission', async () => {
            const allowed = await kernel.getPermission(granted, app, role)
            const owner = await kernel.getPermissionOwner(app, role)

            assert.isTrue(allowed, 'entity should be allowed to perform role actions')
            assert.equal(owner, granted, 'permission parent should be correct')
        })

        it('can perform action', async () => {
            assert.isTrue(await kernel.canPerform(granted, app, role))
        })

        it('can execute action', async () => {
            await kernel.upgradeKernel(accounts[0], { from: granted })
        })

        it('root cannot revoke permission', async () => {
            return assertRevert(async () => {
                await kernel.revokePermission(granted, app, role, { from: permissionsRoot })
            })
        })

        it('root cannot re-create permission', async () => {
            return assertRevert(async () => {
                await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
            })
        })

        it('root cannot grant permission', async () => {
            return assertRevert(async () => {
                await kernel.grantPermission(granted, app, role, { from: permissionsRoot })
            })
        })

        context('transferring ownership', () => {
            const newOwner = accounts[8]

            beforeEach(async () => {
                await kernel.setPermissionOwner(newOwner, app, role, { from: granted })
            })

            it('changes owner', async () => {
                const owner = await kernel.getPermissionOwner(app, role)
                assert.equal(owner, newOwner, 'owner should have changed')
            })

            it('can grant permission', async () => {
                await kernel.grantPermission(newOwner, app, role, { from: newOwner })
            })

            it('old owner lost power', async () => {
                return assertRevert(async () => {
                    await kernel.grantPermission(newOwner, app, role, { from: granted })
                })
            })
        })

        context('self-revokes permission', () => {
            beforeEach(async () => {
                await kernel.revokePermission(granted, app, role, { from: granted })
            })

            it('can no longer perform action', async () => {
                assert.isFalse(await kernel.canPerform(granted, app, role))
            })

            it('permissions root cannot re-create', async () => {
                return assertRevert(async () => {
                    await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
                })
            })
        })

        context('re-grants to child', () => {
            beforeEach(async () => {
                await kernel.grantPermission(child, app, role, { from: granted })
            })

            it('child entity can perform action', async () => {
                assert.isTrue(await kernel.canPerform(child, app, role))
            })

            it('child cannot re-grant permission', async () => {
                return assertRevert(async () => {
                    await kernel.grantPermission(accounts[7], app, role, { from: child })
                })
            })

            it('parent can revoke permission', async () => {
                await kernel.revokePermission(child, app, role, { from: granted })
                assert.isFalse(await kernel.canPerform(child, app, role))
            })
        })
    })
})
