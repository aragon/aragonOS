const { assertRevert } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const { getBlockNumber } = require('./helpers/web3')
const assertEvent = require('./helpers/assertEvent')

const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')

const getSig = x => web3.sha3(x).slice(0, 10)

contract('Kernel ACL', accounts => {
    let kernel, app, factory, acl = {}

    const permissionsRoot = accounts[0]
    const granted = accounts[1]
    const child = accounts[2]

    let role = null

    before(async () => {
        factory = await DAOFactory.new()
    })

    beforeEach(async () => {
        const receipt = await factory.newDAO(permissionsRoot)
        app = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao

        kernel = Kernel.at(app)

        // events for kernel.createPermission permission
        //assertEvent(receipt, 'SetPermission')
        //assertEvent(receipt, 'ChangePermissionManager')

        role = await kernel.APP_MANAGER()
        acl = ACL.at(await kernel.acl())
    })

    it('has correct initialization block', async () => {
        assert.equal(await kernel.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
    })

    it('throws on reinitialization', async () => {
        return assertRevert(async () => {
            await kernel.initialize(accounts[0], accounts[0], accounts[0])
        })
    })

    it('actions cannot be performed by default', async () => {
        assert.isFalse(await acl.hasPermission(permissionsRoot, app, role))
    })

    it('protected actions fail if not allowed', async () => {
        return assertRevert(async () => {
            await kernel.setApp('0x0', '0x0', accounts[0])
        })
    })

    it('create permission action can be performed by root by default', async () => {
        const createPermissionRole = await acl.CREATE_PERMISSIONS_ROLE()
        assert.isTrue(await acl.hasPermission(permissionsRoot, acl.address, createPermissionRole))
    })

    context('creating permission', () => {
        beforeEach(async () => {
            const receipt = await acl.createPermission(granted, app, role, granted, { from: permissionsRoot })
            assertEvent(receipt, 'SetPermission')
            assertEvent(receipt, 'ChangePermissionManager')
        })

        it('fails granting existing permission instance', async () => {
            await acl.grantPermission(accounts[8], app, role, { from: granted })
            return assertRevert(async () => {
                await acl.grantPermission(accounts[8], app, role, { from: granted })
            })
        })

        it('fails revoking non-granted permission', async () => {
            await acl.grantPermission(accounts[8], app, role, { from: granted })
            await acl.revokePermission(accounts[8], app, role, { from: granted })
            return assertRevert(async () => {
                await acl.revokePermission(accounts[8], app, role, { from: granted })
            })
        })

        it('returns created permission', async () => {
            const allowed = await acl.hasPermission(granted, app, role)
            const manager = await acl.getPermissionManager(app, role)

            assert.isTrue(allowed, 'entity should be allowed to perform role actions')
            assert.equal(manager, granted, 'permission parent should be correct')
        })

        it('can perform action', async () => {
            assert.isTrue(await acl.hasPermission(granted, app, role))
        })

        it('can execute action', async () => {
            const receipt = await kernel.setApp('0x0', '0x0', accounts[0], { from: granted })
            assertEvent(receipt, 'SetApp')
        })

        it('root cannot revoke permission', async () => {
            return assertRevert(async () => {
                await acl.revokePermission(granted, app, role, { from: permissionsRoot })
            })
        })

        it('root cannot re-create permission', async () => {
            return assertRevert(async () => {
                await acl.createPermission(granted, app, role, granted, { from: permissionsRoot })
            })
        })

        it('root cannot grant permission', async () => {
            return assertRevert(async () => {
                await acl.grantPermission(granted, app, role, { from: permissionsRoot })
            })
        })

        context('transferring managership', () => {
            const newManager = accounts[8]

            beforeEach(async () => {
                const receipt = await acl.setPermissionManager(newManager, app, role, { from: granted })
                assertEvent(receipt, 'ChangePermissionManager')
            })

            it('changes manager', async () => {
                const manager = await acl.getPermissionManager(app, role)
                assert.equal(manager, newManager, 'manager should have changed')
            })

            it('can grant permission', async () => {
                const receipt = await acl.grantPermission(newManager, app, role, { from: newManager })
                assertEvent(receipt, 'SetPermission')
            })

            /*
            it('fails when setting manager to the zero address', async () => {
                return assertRevert(async () => {
                    await kernel.setPermissionManager('0x00', app, role, { from: newManager })
                })
            })
            */

            it('old manager lost power', async () => {
                return assertRevert(async () => {
                    await acl.grantPermission(newManager, app, role, { from: granted })
                })
            })
        })

        context('self-revokes permission', () => {
            beforeEach(async () => {
                const receipt = await acl.revokePermission(granted, app, role, { from: granted })
                assertEvent(receipt, 'SetPermission')
            })

            it('can no longer perform action', async () => {
                assert.isFalse(await acl.hasPermission(granted, app, role))
            })

            it('permissions root cannot re-create', async () => {
                return assertRevert(async () => {
                    await acl.createPermission(granted, app, role, granted, { from: permissionsRoot })
                })
            })

            it('permission manager can grant the permission', async () => {
                await acl.grantPermission(granted, app, role, { from: granted })
                assert.isTrue(await acl.hasPermission(granted, app, role))
            })
        })

        context('re-grants to child', () => {
            beforeEach(async () => {
                const receipt = await acl.grantPermission(child, app, role, { from: granted })
                assertEvent(receipt, 'SetPermission')
            })

            it('child entity can perform action', async () => {
                assert.isTrue(await acl.hasPermission(child, app, role))
            })

            it('child cannot re-grant permission', async () => {
                return assertRevert(async () => {
                    await acl.grantPermission(accounts[7], app, role, { from: child })
                })
            })

            it('parent can revoke permission', async () => {
                const receipt = await acl.revokePermission(child, app, role, { from: granted })
                assert.isFalse(await acl.hasPermission(child, app, role))
                assertEvent(receipt, 'SetPermission')
            })
        })
    })
})
