const { assertRevert } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const { getBlockNumber } = require('./helpers/web3')
const assertEvent = require('./helpers/assertEvent')

const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')

const getContract = artifacts.require

const getSig = x => web3.sha3(x).slice(0, 10)

contract('Kernel ACL', accounts => {
    let kernel, app, factory, acl = {}

    const permissionsRoot = accounts[0]
    const granted = accounts[1]
    const child = accounts[2]

    let role = null

    before(async () => {
        const kernelBase = await getContract('Kernel').new()
        const aclBase = await getContract('ACL').new()
        factory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x00')
    })

    beforeEach(async () => {
        const receipt = await factory.newDAO(permissionsRoot)
        app = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao

        kernel = Kernel.at(app)

        // events for kernel.createPermission permission
        //assertEvent(receipt, 'SetPermission')
        //assertEvent(receipt, 'ChangePermissionManager')

        role = await kernel.APP_MANAGER_ROLE()
        acl = ACL.at(await kernel.acl())
    })

    it('cannot initialize ACL outside of Kernel', async () => {
        const acl = await ACL.new()
        return assertRevert(async () => {
            await acl.initialize('0x1234')
        })
    })

    it('has correct initialization block', async () => {
        assert.equal(await kernel.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
    })

    it('throws on reinitialization', async () => {
        return assertRevert(async () => {
            await kernel.initialize(accounts[0], accounts[0])
        })
    })


    it('actions cannot be performed by default', async () => {
        assert.isFalse(await acl.hasPermission(permissionsRoot, app, role))
    })

    it('actions cannot be performed if uninitialized', async () => {
        const newKernelProxy = await KernelProxy.new(await factory.baseKernel())
        const newKernel = Kernel.at(newKernelProxy.address)
        return assertRevert(async () => {
          const result = await newKernel.hasPermission(permissionsRoot, app, role, '0x00')
        })
    })

    it('protected actions fail if not allowed', async () => {
        return assertRevert(async () => {
            await kernel.setApp('0x0', '0x1234', accounts[0])
        })
    })

    it('create permission action can be performed by root by default', async () => {
        const createPermissionRole = await acl.CREATE_PERMISSIONS_ROLE()
        assert.isTrue(await acl.hasPermission(permissionsRoot, acl.address, createPermissionRole))
    })

    it('cannot create permissions without permission', async () => {
        return assertRevert(async () => {
            await acl.createPermission(granted, app, role, granted, { from: accounts[8] })
        })
    })

    context('creating permission', () => {
        beforeEach(async () => {
            const receipt = await acl.createPermission(granted, app, role, granted, { from: permissionsRoot })
            assertEvent(receipt, 'SetPermission')
            assertEvent(receipt, 'ChangePermissionManager')
        })

        it('can grant permission with params', async () => {
            // app id != 0 (kernel)
            // param hash 0x68b4adfe8175b29530f1c715f147337823f4ae55693be119bef69129637d681f
            const argId = '0x00' // arg 0
            const op = '02'      // not equal
            const value = '000000000000000000000000000000000000000000000000000000000000'  // namespace 0
            const param = new web3.BigNumber(`${argId}${op}${value}`)

            const r1 = await acl.grantPermissionP(accounts[3], app, role, [param], { from: granted })

            // retrieve the params back with the getters
            const numParams = await acl.getPermissionParamsLength(accounts[3], app, role)
            assert.equal(numParams, 1, 'There should be just 1 param')
            const returnedParam = await acl.getPermissionParam(accounts[3], app, role, 0)
            assert.equal(returnedParam[0].valueOf(), parseInt(argId, 16), 'param id should match')
            assert.equal(returnedParam[1].valueOf(), parseInt(op, 10), 'param op should match')
            assert.equal(returnedParam[2].valueOf(), parseInt(value, 10), 'param value should match')

            // grants again without re-saving params
            const r2 = await acl.grantPermissionP(accounts[4], app, role, [param], { from: granted })

            assert.isBelow(r2.receipt.gasUsed, r1.receipt.gasUsed, 'should have used less gas because of cache')
            // Allow setting code for namespace other than 0
            // acl is used here just to provide an address which is a contract
            const receipt = await kernel.setApp('0x121212', '0x00', acl.address, { from: accounts[4] })

            assertEvent(receipt, 'SetApp')
            return assertRevert(async () => {
                // Fail if setting code for appId 0
                await kernel.setApp('0x0', '0x0', acl.address, { from: accounts[3] })
            })
        })

        it('can grant a public permission', async () => {
            const anyEntity = "0xffffffffffffffffffffffffffffffffffffffff"

            await acl.grantPermission(anyEntity, app, role, { from: granted })
            // many entities can succesfully perform action
            // acl is used here just to provide an address which is a contract
            await kernel.setApp('0x121212', '0x00', acl.address, { from: accounts[4] })
            await kernel.setApp('0x121212', '0x00', acl.address, { from: accounts[6] })
            await kernel.setApp('0x121212', '0x00', acl.address, { from: accounts[8] })
            assert.isTrue(await acl.hasPermission(accounts[6], app, role), 'should have perm')
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
            // acl is used here just to provide an address which is a contract
            const receipt = await kernel.setApp('0x1234', '0x1234', acl.address, { from: granted })
            assertEvent(receipt, 'SetApp')
        })

        it('root cannot revoke permission', async () => {
            return assertRevert(async () => {
                await acl.revokePermission(granted, app, role, { from: permissionsRoot })
            })
        })

        it('root cannot re-create permission', async () => {
            return assertRevert(async () => {
                await acl.createPermission(granted, app, role, granted, { from: permissionsRoot })
            })
        })

        it('root cannot grant permission', async () => {
            // Make sure grandchild doesn't have permission yet
            assert.isFalse(await acl.hasPermission(child, app, role))
            return assertRevert(async () => {
                await acl.grantPermission(child, app, role, { from: permissionsRoot })
            })
        })

        context('transferring managership', () => {
            const newManager = accounts[8]
            assert.notEqual(newManager, granted, 'newManager should not be the same as granted')

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

            it('old manager lost power', async () => {
                // Make sure new manager doesn't have permission yet
                assert.isFalse(await acl.hasPermission(newManager, app, role))
                return assertRevert(async () => {
                    await acl.grantPermission(newManager, app, role, { from: granted })
                })
            })
        })

        context('removing managership', () => {
            const newManager = accounts[4]
            assert.notEqual(newManager, granted, 'newManager should not be the same as granted')

            beforeEach(async () => {
                const receipt = await acl.removePermissionManager(app, role, { from: granted })
                assertEvent(receipt, 'ChangePermissionManager')
            })

            it('removes manager', async () => {
                const noManager = await acl.getPermissionManager(app, role)
                assert.equal('0x0000000000000000000000000000000000000000', noManager, 'manager should have been removed')
            })

            it('can recreate permission', async () => {
                const createReceipt = await acl.createPermission(newManager, app, role, newManager, { from: permissionsRoot })
                assertEvent(createReceipt, 'SetPermission')
                assertEvent(createReceipt, 'ChangePermissionManager')

                const grantReceipt = await acl.grantPermission(granted, app, role, { from: newManager })
                assertEvent(grantReceipt, 'SetPermission')
            })

            it('old manager lost power', async () => {
                // Make sure new manager doesn't have permission yet
                assert.isFalse(await acl.hasPermission(newManager, app, role))
                return assertRevert(async () => {
                    await acl.grantPermission(newManager, app, role, { from: granted })
                })
            })
        })

        context('self-revokes permission', () => {
            beforeEach(async () => {
                const receipt = await acl.revokePermission(granted, app, role, { from: granted })
                assertEvent(receipt, 'SetPermission')
            })

            it('can no longer perform action', async () => {
                assert.isFalse(await acl.hasPermission(granted, app, role))
            })

            it('permissions root cannot re-create', async () => {
                return assertRevert(async () => {
                    await acl.createPermission(granted, app, role, granted, { from: permissionsRoot })
                })
            })

            it('permission manager can grant the permission', async () => {
                await acl.grantPermission(granted, app, role, { from: granted })
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
                const grandchild = accounts[7]
                // Make sure grandchild doesn't have permission yet
                assert.isFalse(await acl.hasPermission(grandchild, app, role))
                return assertRevert(async () => {
                    await acl.grantPermission(grandchild, app, role, { from: child })
                })
            })

            it('parent can revoke permission', async () => {
                const receipt = await acl.revokePermission(child, app, role, { from: granted })
                assert.isFalse(await acl.hasPermission(child, app, role))
                assertEvent(receipt, 'SetPermission')
            })
        })
    })
})
