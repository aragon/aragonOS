const { assertInvalidOpcode } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

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

    it('throws on reinitialization', async () => {
        return assertInvalidOpcode(async () => {
            await kernel.initialize(accounts[0])
        })
    })

    it('actions cannot be performed by default', async () => {
        assert.isFalse(await kernel.canPerform(permissionsRoot, app, role))
    })

    it('protected actions fail if not allowed', async () => {
        return assertInvalidOpcode(async () => {
            await kernel.upgradeKernel(accounts[0])
        })
    })

    it('create permission action can be performed by root by default', async () => {
        const createPermissionRole = await kernel.CREATE_PERMISSIONS_ROLE()
        assert.isTrue(await kernel.canPerform(permissionsRoot, kernel.address, createPermissionRole))
    })

    context('creating permission setting as parent', () => {
        beforeEach(async () => {
            await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
        })

        it('can perform action', async () => {
            assert.isTrue(await kernel.canPerform(granted, app, role))
        })

        it('can execute action', async () => {
            await kernel.upgradeKernel(accounts[0], { from: granted })
        })

        it('root cannot revoke permission', async () => {
            return assertInvalidOpcode(async () => {
                await kernel.revokePermission(granted, app, role, { from: permissionsRoot })
            })
        })

        it('root cannot re-create permission', async () => {
            return assertInvalidOpcode(async () => {
                await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
            })
        })

        it('root cannot grant permission', async () => {
            return assertInvalidOpcode(async () => {
                await kernel.grantPermission(granted, app, role, granted, { from: permissionsRoot })
            })
        })

        context('self-revokes permission', () => {
            beforeEach(async () => {
                await kernel.revokePermission(granted, app, role, { from: granted })
            })

            it('can no longer perform action', async () => {
                assert.isFalse(await kernel.canPerform(granted, app, role))
            })

            it('permissions root can re-create', async () => {
                await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
                assert.isTrue(await kernel.canPerform(granted, app, role))
            })
        })

        context('re-grants to child', () => {
            beforeEach(async () => {
                await kernel.grantPermission(child, app, role, granted, { from: granted })
            })

            it('child entity can perform action', async () => {
                assert.isTrue(await kernel.canPerform(child, app, role))
            })

            it('child cannot re-grant permission', async () => {
                return assertInvalidOpcode(async () => {
                    await kernel.grantPermission(accounts[7], app, role, child, { from: child })
                })
            })

            it('parent can revoke permission', async () => {
                await kernel.revokePermission(child, app, role, { from: granted })
                assert.isFalse(await kernel.canPerform(child, app, role))
            })

            it('cannot be reset to change parent', async () => {
                return assertInvalidOpcode(async () => {
                    await kernel.grantPermission(child, app, role, accounts[7], { from: granted })
                })
            })
        })
    })
})
