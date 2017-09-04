const { assertInvalidOpcode } = require('./helpers/assertThrow')
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
        await kernel.createPermission(accounts[0], kernel.address, getSig('setAppCode(bytes32,address)'), accounts[0])

        appCode1 = await AppStub.new()
        appCode2 = await AppStub2.new()

        const appProxy = await AppProxy.new(kernel.address, appId)
        await kernel.createPermission(accounts[0], appProxy.address, getSig('setValue(uint256)'), accounts[0])
        app = AppStub.at(appProxy.address)
    })

    it('throws if using app without reference in kernel', async () => {
        return assertInvalidOpcode(async () => {
            await app.setValue(10)
        })
    })

    context('setting app code in kernel', async () => {
        beforeEach(async () => {
            await kernel.setAppCode(appId, appCode1.address)
        })

        it('app call works if sent from authed entity', async () => {
            await app.setValue(10)
            assert.equal(await app.getValue(), 10, 'should have returned correct value')
        })

        it('throws when called by unauthorized entity', async () => {
            return assertInvalidOpcode(async () => {
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
            return assertInvalidOpcode(async () => {
                await app.setValue(10)
            })
        })
    })
})
