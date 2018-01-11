const { assertRevert } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const { getBlockNumber } = require('./helpers/web3')
const assertEvent = require('./helpers/assertEvent')

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
        const receipt = await kernel.initialize(permissionsRoot)
        // events for kernel.createPermission permission
        assertEvent(receipt, 'SetPermission')
        assertEvent(receipt, 'ChangePermissionManager')

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
        assert.isFalse(await kernel.hasPermission(permissionsRoot, app, role))
    })

    it('protected actions fail if not allowed', async () => {
        return assertRevert(async () => {
            await kernel.upgradeKernel(accounts[0])
        })
    })

    it('create permission action can be performed by root by default', async () => {
        const createPermissionRole = await kernel.CREATE_PERMISSIONS_ROLE()
        assert.isTrue(await kernel.hasPermission(permissionsRoot, kernel.address, createPermissionRole))
    })

    context('creating permission', () => {
        beforeEach(async () => {
            const receipt = await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
            assertEvent(receipt, 'SetPermission')
            assertEvent(receipt, 'ChangePermissionManager')
        })

        it('fails granting existing permission instance', async () => {
            await kernel.grantPermission(accounts[8], app, role, { from: granted })
            return assertRevert(async () => {
                await kernel.grantPermission(accounts[8], app, role, { from: granted })
            })
        })

        it('fails revoking non-granted permission', async () => {
            await kernel.grantPermission(accounts[8], app, role, { from: granted })
            await kernel.revokePermission(accounts[8], app, role, { from: granted })
            return assertRevert(async () => {
                await kernel.revokePermission(accounts[8], app, role, { from: granted })
            })
        })

        it('returns created permission', async () => {
            const allowed = await kernel.hasPermission(granted, app, role)
            const manager = await kernel.getPermissionManager(app, role)

            assert.isTrue(allowed, 'entity should be allowed to perform role actions')
            assert.equal(manager, granted, 'permission parent should be correct')
        })

        it('can perform action', async () => {
            assert.isTrue(await kernel.hasPermission(granted, app, role))
        })

        it('can execute action', async () => {
            const receipt = await kernel.upgradeKernel(accounts[0], { from: granted })
            assertEvent(receipt, 'UpgradeKernel')
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

        context('transferring managership', () => {
            const newManager = accounts[8]

            beforeEach(async () => {
                const receipt = await kernel.setPermissionManager(newManager, app, role, { from: granted })
                assertEvent(receipt, 'ChangePermissionManager')
            })

            it('changes manager', async () => {
                const manager = await kernel.getPermissionManager(app, role)
                assert.equal(manager, newManager, 'manager should have changed')
            })

            it('can grant permission', async () => {
                const receipt = await kernel.grantPermission(newManager, app, role, { from: newManager })
                assertEvent(receipt, 'SetPermission')
            })

            it('fails when setting manager to the zero address', async () => {
                return assertRevert(async () => {
                    await kernel.setPermissionManager('0x00', app, role, { from: newManager })
                })
            })

            it('old manager lost power', async () => {
                return assertRevert(async () => {
                    await kernel.grantPermission(newManager, app, role, { from: granted })
                })
            })
        })

        context('self-revokes permission', () => {
            beforeEach(async () => {
                const receipt = await kernel.revokePermission(granted, app, role, { from: granted })
                assertEvent(receipt, 'SetPermission')
            })

            it('can no longer perform action', async () => {
                assert.isFalse(await kernel.hasPermission(granted, app, role))
            })

            it('permissions root cannot re-create', async () => {
                return assertRevert(async () => {
                    await kernel.createPermission(granted, app, role, granted, { from: permissionsRoot })
                })
            })

            it('permission manager can grant the permission', async () => {
                await kernel.grantPermission(granted, app, role, { from: granted })
                assert.isTrue(await kernel.hasPermission(granted, app, role))
            })
        })

        context('re-grants to child', () => {
            beforeEach(async () => {
                const receipt = await kernel.grantPermission(child, app, role, { from: granted })
                assertEvent(receipt, 'SetPermission')
            })

            it('child entity can perform action', async () => {
                assert.isTrue(await kernel.hasPermission(child, app, role))
            })

            it('child cannot re-grant permission', async () => {
                return assertRevert(async () => {
                    await kernel.grantPermission(accounts[7], app, role, { from: child })
                })
            })

            it('parent can revoke permission', async () => {
                const receipt = await kernel.revokePermission(child, app, role, { from: granted })
                assert.isFalse(await kernel.hasPermission(child, app, role))
                assertEvent(receipt, 'SetPermission')
            })
        })
    })
})
