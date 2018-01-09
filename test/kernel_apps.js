const { assertRevert } = require('./helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const Kernel = artifacts.require('Kernel')
const AppProxy = artifacts.require('AppProxy')
const AppStub = artifacts.require('AppStub')
const AppStub2 = artifacts.require('AppStub2')

const getSig = x => web3.sha3(x).slice(0, 10)

contract('Kernel apps', accounts => {
    let kernel, app, appCode1, appCode2 = {}
    const appId = hash('stub.aragonpm.test')

    beforeEach(async () => {
        kernel = await Kernel.new()
        await kernel.initialize(accounts[0])
        const r = await kernel.UPGRADE_APPS_ROLE()
        await kernel.createPermission(accounts[0], kernel.address, r, accounts[0])

        appCode1 = await AppStub.new()
        appCode2 = await AppStub2.new()
    })

    it('fails if initializing on constructor before setting app code', async () => {
        const initializationPayload = appCode1.contract.initialize.getData()

        return assertRevert(async () => {
            await AppProxy.new(kernel.address, appId, initializationPayload)
        })
    })

    context('initializing on proxy constructor', () => {
        beforeEach(async () => {
            await kernel.setAppCode(appId, appCode1.address)

            const initializationPayload = appCode1.contract.initialize.getData()
            const appProxy = await AppProxy.new(kernel.address, appId, initializationPayload, { gas: 5e6 })
            app = AppStub.at(appProxy.address)
        })

        it('was initialized on constructor', async () => {
            assert.isTrue(await app.initialized(), 'app should have been initialized')
        })

        it('cannot reinitialize', async () => {
            return assertRevert(async () => {
                await app.initialize()
            })
        })

        it('should return values', async () => {
            assert.equal(await app.stringTest(), 'hola', 'string test')
        })
    })

    context('not initializing on proxy constructor', () => {
        beforeEach(async () => {
            const initializationPayload = '0x' // dont initialize
            const appProxy = await AppProxy.new(kernel.address, appId, initializationPayload)
            app = AppStub.at(appProxy.address)

            // assign app permissions
            const r2 = await appCode1.ROLE()
            await kernel.createPermission(accounts[0], appProxy.address, r2, accounts[0])
        })

        it('throws if using app without reference in kernel', async () => {
            return assertRevert(async () => {
                await app.setValue(10)
            })
        })

        context('setting app code in kernel', async () => {
            beforeEach(async () => {
                await kernel.setAppCode(appId, appCode1.address)
            })

            it('can initialize', async () => {
                await app.initialize()

                assert.isTrue(await app.initialized(), 'app should have been initialized')
            })

            it('app call works if sent from authed entity', async () => {
                await app.setValue(10)
                assert.equal(await app.getValue(), 10, 'should have returned correct value')
            })

            it('fails when called by unauthorized entity', async () => {
                return assertRevert(async () => {
                    await app.setValue(10, { from: accounts[1] })
                })
            })

            it('can update app code and storage is preserved', async () => {
                await app.setValue(10)
                await kernel.setAppCode(appId, appCode2.address)
                // app2 returns the double of the value in storage
                assert.equal(await app.getValue(), 20, 'app 2 should have returned correct value')
            })

            it('can update app code and removed functions throw', async () => {
                await app.setValue(10)
                await kernel.setAppCode(appId, appCode2.address)
                return assertRevert(async () => {
                    await app.setValue(10)
                })
            })
        })
    })
})
