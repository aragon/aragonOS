const { assertInvalidOpcode } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

const getSig = x => web3.sha3(x).slice(0, 10)

contract('Kernel ACL', accounts => {
    let kernel, app = {}

    const permissionsRoot = accounts[0]
    const granted = accounts[1]
    const child = accounts[2]

    const action = getSig('upgradeKernel(address)')

    beforeEach(async () => {
        const kernelImpl = await Kernel.new()
        const kernelProxy = await KernelProxy.new(kernelImpl.address)
        kernel = Kernel.at(kernelProxy.address)
        app = kernel.address
        await kernel.initialize(permissionsRoot)
    })

    it('throws on reinitialization', async () => {
        return assertInvalidOpcode(async () => {
            await kernel.initialize(accounts[0])
        })
    })

    it('actions cannot be performed by default', async () => {
        assert.isFalse(await kernel.canPerform(permissionsRoot, app, action))
    })

    it('protected actions fail if not allowed', async () => {
        return assertInvalidOpcode(async () => {
            await kernel.upgradeKernel(accounts[0])
        })
    })

    it('create permission action can be performed by root by default', async () => {
        const createPermissionAction = 'createPermission(address,address,bytes4,address)'
        assert.isTrue(await kernel.canPerform(permissionsRoot, kernel.address, getSig(createPermissionAction)))
    })

    context('creating permission setting as parent', () => {
        beforeEach(async () => {
            await kernel.createPermission(granted, app, action, granted, { from: permissionsRoot })
        })

        it('can perform action', async () => {
            assert.isTrue(await kernel.canPerform(granted, app, action))
        })

        it('can execute action', async () => {
            await kernel.upgradeKernel(accounts[0], { from: granted })
        })

        it('root cannot revoke permission', async () => {
            return assertInvalidOpcode(async () => {
                await kernel.revokePermission(granted, app, action, { from: permissionsRoot })
            })
        })

        it('root cannot re-create permission', async () => {
            return assertInvalidOpcode(async () => {
                await kernel.createPermission(granted, app, action, granted, { from: permissionsRoot })
            })
        })

        it('root cannot grant permission', async () => {
            return assertInvalidOpcode(async () => {
                await kernel.grantPermission(granted, app, action, granted, { from: permissionsRoot })
            })
        })

        context('self-revokes permission', () => {
            beforeEach(async () => {
                await kernel.revokePermission(granted, app, action, { from: granted })
            })

            it('can no longer perform action', async () => {
                assert.isFalse(await kernel.canPerform(granted, app, action))
            })

            it('permissions root can re-create', async () => {
                await kernel.createPermission(granted, app, action, granted, { from: permissionsRoot })
                assert.isTrue(await kernel.canPerform(granted, app, action))
            })
        })

        context('re-grants to child', () => {
            beforeEach(async () => {
                await kernel.grantPermission(child, app, action, granted, { from: granted })
            })

            it('child entity can perform action', async () => {
                assert.isTrue(await kernel.canPerform(child, app, action))
            })

            it('child cannot re-grant permission', async () => {
                return assertInvalidOpcode(async () => {
                    await kernel.grantPermission(accounts[7], app, action, child, { from: child })
                })
            })

            it('parent can revoke permission', async () => {
                await kernel.revokePermission(child, app, action, { from: granted })
                assert.isFalse(await kernel.canPerform(child, app, action))
            })

            it('cannot be reset to change parent', async () => {
                return assertInvalidOpcode(async () => {
                    await kernel.grantPermission(child, app, action, accounts[7], { from: granted })
                })
            })
        })
    })
})
