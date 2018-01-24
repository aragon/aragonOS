const { assertRevert } = require('./helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const Kernel = artifacts.require('Kernel')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppProxyPinned = artifacts.require('AppProxyPinned')
const AppStub = artifacts.require('AppStub')
const AppStub2 = artifacts.require('AppStub2')
const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')

const getSig = x => web3.sha3(x).slice(0, 10)

const keccak256 = require('js-sha3').keccak_256
const APP_BASE_NAMESPACE = '0x'+keccak256('base')

contract('Kernel apps', accounts => {
    let factory, acl, kernel, app, appProxy, appCode1, appCode2 = {}

    const permissionsRoot = accounts[0]
    const appId = hash('stub.aragonpm.test')

    before(async () => {
        factory = await DAOFactory.new()
        appCode1 = await AppStub.new()
        appCode2 = await AppStub2.new()
    })

    beforeEach(async () => {
        const receipt = await factory.newDAO(permissionsRoot)
        app = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao

        kernel = Kernel.at(app)
        acl = ACL.at(await kernel.acl())

        const r = await kernel.APP_MANAGER_ROLE()
        await acl.createPermission(permissionsRoot, kernel.address, r, permissionsRoot)

        code1 = await AppStub.new()
        code2 = await AppStub2.new()
    })

    it('fails if initializing on constructor before setting app code', async () => {
        const initializationPayload = code1.contract.initialize.getData()

        return assertRevert(async () => {
            await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload)
        })
    })

    context('upgradeable proxies', () => {
        it('fails if code hasnt been set and initializes', async () => {
            return assertRevert(async () => {
                await AppProxyUpgradeable.new(kernel.address, appId, appCode1.contract.initialize.getData(), { gas: 5e6 })
            })
        })

        it('doesnt fail if code hasnt been set and doesnt initialize', async () => {
            await AppProxyUpgradeable.new(kernel.address, appId, '0x', { gas: 5e6 })
        })

        context('initializing on proxy constructor', () => {
            beforeEach(async () => {
                await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)

                const initializationPayload = appCode1.contract.initialize.getData()
                appProxy = await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload, { gas: 5e6 })
                app = AppStub.at(appProxy.address)
            })

            it('fails if init fails', async () => {
                const badInit = '0x1234'
                return assertRevert(async () => {
                    await AppProxyUpgradeable.new(kernel.address, appId, badInit, { gas: 5e6 })
                })
            })

            it('was initialized on constructor', async () => {
                assert.isAbove(await app.getInitializationBlock(), 0, 'app should have been initialized')
            })

            it('is upgradeable', async () => {
                assert.isTrue(await appProxy.isUpgradeable.call(), 'appproxy should have be upgradeable')
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
                appProxy = await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload)
                app = AppStub.at(appProxy.address)

                // assign app permissions
                const r2 = await appCode1.ROLE()
                await acl.createPermission(permissionsRoot, appProxy.address, r2, permissionsRoot)
            })

            it('throws if using app without reference in kernel', async () => {
                return assertRevert(async () => {
                    await app.setValue(10)
                })
            })

            context('setting app code in kernel', async () => {
                beforeEach(async () => {
                    await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
                })

                it('can initialize', async () => {
                    await app.initialize()

                    assert.isAbove(await app.getInitializationBlock(), 0, 'app should have been initialized')
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

                it('fails if updated app is not a contract', async () => {
                    await kernel.setApp(APP_BASE_NAMESPACE, appId, '0x1234')
                    return assertRevert(async () => {
                        await app.setValue(10)
                    })
                })

                it('can update app code and storage is preserved', async () => {
                    await app.setValue(10)
                    await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode2.address)
                    // app2 returns the double of the value in storage
                    assert.equal(await app.getValue(), 20, 'app 2 should have returned correct value')
                })

                it('can update app code and removed functions throw', async () => {
                    await app.setValue(10)
                    await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode2.address)
                    return assertRevert(async () => {
                        await app.setValue(10)
                    })
                })
            })
        })
    })

    context('pinned proxies', () => {
        beforeEach(async () => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)

            const initializationPayload = appCode1.contract.initialize.getData()
            appProxy = await AppProxyPinned.new(kernel.address, appId, initializationPayload, { gas: 5e6 })
            app = AppStub.at(appProxy.address)

            // assign app permissions
            const r2 = await appCode1.ROLE()
            await acl.createPermission(permissionsRoot, appProxy.address, r2, permissionsRoot)
        })

        it('fails if code hasnt been set on deploy', async () => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, '0x0')
            return assertRevert(async () => {
                await AppProxyPinned.new(kernel.address, appId, '0x', { gas: 5e6 })
            })
        })

        it('is not upgradeable', async () => {
            assert.isFalse(await appProxy.isUpgradeable.call(), 'appproxy should not be upgradeable')
        })

        it('can update app code and pinned proxy continues using former version', async () => {
            await app.setValue(10)
            await app.setValue(11)
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode2.address)

            // app2 would return the double of the value in storage
            assert.equal(await app.getValue(), 11, 'app 2 should have returned correct value')
        })
    })
})
