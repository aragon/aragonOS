const { assertRevert } = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')
const Kernel = artifacts.require('Kernel')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppProxyPinned = artifacts.require('AppProxyPinned')
const AppStub = artifacts.require('AppStub')
const AppStub2 = artifacts.require('AppStub2')
const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')

const getSig = x => web3.sha3(x).slice(0, 10)
const getContract = artifacts.require

const keccak256 = require('js-sha3').keccak_256
const APP_BASE_NAMESPACE = '0x'+keccak256('base')

contract('Kernel apps', accounts => {
    let factory, acl, kernel, app, appProxy, appCode1, appCode2 = {}
    let UPGRADEABLE, FORWARDING

    const permissionsRoot = accounts[0]
    const appId = hash('stub.aragonpm.test')
    const zeroAddr = '0x0000000000000000000000000000000000000000'

    before(async () => {
        const kernelBase = await getContract('Kernel').new()
        const aclBase = await getContract('ACL').new()
        factory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x00')
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
                await AppProxyUpgradeable.new(kernel.address, appId, appCode1.contract.initialize.getData(), { gas: 6e6 })
            })
        })

        it('doesnt fail if code hasnt been set and doesnt initialize', async () => {
            await AppProxyUpgradeable.new(kernel.address, appId, '0x', { gas: 6e6 })
        })

        context('initializing on proxy constructor', () => {
            beforeEach(async () => {
                await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)

                const initializationPayload = appCode1.contract.initialize.getData()
                appProxy = await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload, { gas: 6e6 })
                app = AppStub.at(appProxy.address)
                UPGRADEABLE = (await appProxy.UPGRADEABLE()).toString()
            })

            it('checks ERC897 functions', async () => {
                const implementation = await appProxy.implementation()
                assert.equal(implementation, appCode1.address, "App address should match")
                const proxyType = (await appProxy.proxyType.call()).toString()
                assert.equal(proxyType, UPGRADEABLE, "Proxy type should be upgradeable")
            })

            it('fails if kernel addr is not a kernel', async () => {
                return assertRevert(async () => {
                    await AppProxyUpgradeable.new('0x1234', appId, '0x', { gas: 6e6 })
                })
            })

            it('fails if kernel addr is 0', async () => {
                return assertRevert(async () => {
                    await AppProxyUpgradeable.new('0x0', appId, '0x', { gas: 6e6 })
                })
            })

            it('fails if init fails', async () => {
                const badInit = '0x1234'
                return assertRevert(async () => {
                    await AppProxyUpgradeable.new(kernel.address, appId, badInit, { gas: 6e6 })
                })
            })

            it('was initialized on constructor', async () => {
                assert.isAbove(await app.getInitializationBlock(), 0, 'app should have been initialized')
            })

            it('is upgradeable', async () => {
                assert.equal((await appProxy.proxyType.call()).toString(), UPGRADEABLE, 'appproxy should be upgradeable')
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
            let r2 = {}
            beforeEach(async () => {
                const initializationPayload = '0x' // dont initialize
                appProxy = await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload)
                app = AppStub.at(appProxy.address)

                // assign app permissions
                r2 = await appCode1.ROLE()
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

                it('fails calling function with isInitialized (if it\'s not)', async () => {
                    return assertRevert(async () => {
                        await app.requiresInitialization()
                    })
                })

                it('can initialize', async () => {
                    await app.initialize()

                    assert.isAbove(await app.getInitializationBlock(), 0, 'app should have been initialized')
                })

                it('allows calls with isInitialized modifier', async () => {
                    await app.initialize()
                    const result = await app.requiresInitialization()
                    assert.equal(result, true, "Should return true")
                })

                it('app call works if sent from authed entity', async () => {
                    await app.setValue(10)
                    assert.equal(await app.getValue(), 10, 'should have returned correct value')
                })

                it('parametrized app call works if no params', async () => {
                    await app.setValueParam(11)
                    assert.equal(await app.getValue(), 11, 'should have returned correct value')
                })

                context('parametrized calls', () => {
                    beforeEach(async () => {
                        const argId = '0x00' // arg 0
                        const op = '03'      // greater than
                        const value = '000000000000000000000000000000000000000000000000000000000005'  // 5
                        const param = new web3.BigNumber(`${argId}${op}${value}`)

                        await acl.grantPermissionP(accounts[2], appProxy.address, r2, [param], { from: permissionsRoot })
                    })

                    it('parametrized app call fails if param eval fails', async () => {
                        return assertRevert(async () => {
                            await app.setValueParam(4, { from: accounts[2]})
                        })
                    })

                    it('parametrized app call succeeds if param eval succeeds', async () => {
                        await app.setValueParam(6, { from: accounts[2]})
                    })
                })

                it('fails when called by unauthorized entity', async () => {
                    return assertRevert(async () => {
                        await app.setValue(10, { from: accounts[1] })
                    })
                })

                it('fails if updated app is not a contract', async () => {
                    return assertRevert(async () => {
                        await kernel.setApp(APP_BASE_NAMESPACE, appId, '0x1234')
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
            appProxy = await AppProxyPinned.new(kernel.address, appId, initializationPayload, { gas: 6e6 })
            app = AppStub.at(appProxy.address)
            FORWARDING = (await appProxy.FORWARDING()).toString()

            // assign app permissions
            const r2 = await appCode1.ROLE()
            await acl.createPermission(permissionsRoot, appProxy.address, r2, permissionsRoot)
        })

        it('checks ERC897 functions', async () => {
            const implementation = await appProxy.implementation()
            assert.equal(implementation, appCode1.address, "App address should match")
            const proxyType = (await appProxy.proxyType.call()).toString()
            assert.equal(proxyType, FORWARDING, "Proxy type should be forwarding")
        })

        it('fails if app set is not a contract', async () => {
            return assertRevert(async () => {
                await kernel.setApp(APP_BASE_NAMESPACE, appId, '0x0')
            })
        })

        it('is not upgradeable', async () => {
            assert.equal((await appProxy.proxyType.call()).toString(), FORWARDING, 'appproxy should not be upgradeable')
        })

        it('can update app code and pinned proxy continues using former version', async () => {
            await app.setValue(10)
            await app.setValue(11)
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode2.address)

            // app2 would return the double of the value in storage
            assert.equal(await app.getValue(), 11, 'app 2 should have returned correct value')
        })
    })

    context('new app instances', () => {
        const appSetId = web3.sha3(APP_BASE_NAMESPACE + appId.substring(2), { encoding: 'hex' })

        it('creates a new upgradeable app proxy instance', async () => {
            const receipt = await kernel.newAppInstance(appId, appCode1.address)
            const appProxy = AppProxyUpgradeable.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
            UPGRADEABLE = (await appProxy.UPGRADEABLE()).toString()
            assert.equal((await appProxy.proxyType.call()).toString(), UPGRADEABLE, 'new appProxy instance should be upgradeable')
            assert.equal(await appProxy.kernel(), kernel.address, "new appProxy instance's kernel should be set to the originating kernel")
            assert.equal(await appProxy.implementation(), appCode1.address, 'new appProxy instance should be resolving to implementation address')
        })

        it('sets the app base when not previously registered', async() => {
            assert.equal(zeroAddr, await kernel.getApp(appSetId))

            const appProxy = await kernel.newAppInstance(appId, appCode1.address)
            assert.equal(appCode1.address, await kernel.getApp(appSetId))
        })

        it("doesn't set the app base when already set", async() => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            const receipt = await kernel.newAppInstance(appId, appCode1.address)
            assert.isFalse(receipt.logs.includes(l => l.event == 'SetApp'))
        })

        it("fails if the app base is not given", async() => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            assert.equal(appCode1.address, await kernel.getApp(appSetId))

            return assertRevert(async () => {
                const appProxy = await kernel.newAppInstance(appId, '0x0')
            })
        })

        it('fails if the given app base is different than the existing one', async() => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            return assertRevert(async () => {
                await kernel.newAppInstance(appId, appCode2.address)
            })
        })
    })

    context('new pinned app instances', () => {
        const appSetId = web3.sha3(APP_BASE_NAMESPACE + appId.substring(2), { encoding: 'hex' })

        it('creates a new non upgradeable app proxy instance', async () => {
            const receipt = await kernel.newPinnedAppInstance(appId, appCode1.address)
            const appProxy = AppProxyPinned.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
            FORWARDING = (await appProxy.FORWARDING()).toString()
            assert.equal((await appProxy.proxyType.call()).toString(), FORWARDING, 'new appProxy instance should be not upgradeable')
            assert.equal(await appProxy.kernel(), kernel.address, "new appProxy instance's kernel should be set to the originating kernel")
            assert.equal(await appProxy.implementation(), appCode1.address, 'new appProxy instance should be resolving to implementation address')
        })

        it('sets the app base when not previously registered', async() => {
            assert.equal(zeroAddr, await kernel.getApp(appSetId))

            const appProxy = await kernel.newPinnedAppInstance(appId, appCode1.address)
            assert.equal(appCode1.address, await kernel.getApp(appSetId))
        })

        it("doesn't set the app base when already set", async() => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            const receipt = await kernel.newPinnedAppInstance(appId, appCode1.address)
            assert.isFalse(receipt.logs.includes(l => l.event == 'SetApp'))
        })

        it("fails if the app base is not given", async() => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            assert.equal(appCode1.address, await kernel.getApp(appSetId))

            return assertRevert(async () => {
                const appProxy = await kernel.newPinnedAppInstance(appId, '0x0')
            })
        })

        it('fails if the given app base is different than the existing one', async() => {
            await kernel.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            return assertRevert(async () => {
                await kernel.newPinnedAppInstance(appId, appCode2.address)
            })
        })

        it('fails if app id does not have code set to it yet', async () => {
            const fakeAppId = hash('fake.aragonpm.test')
            const appFact = await getContract('AppProxyFactory').new()
            return assertRevert(async () => {
                await appFact.newAppProxyPinned(kernel.address, fakeAppId, '')
            })
        })
    })

    context('kernel integrity', async () => {
        let kernelNoProxy

        before(async () => {
            kernelNoProxy = await getContract('Kernel').new()
            // ACL
            const aclBase = await getContract('ACL').new()
            await kernelNoProxy.initialize(aclBase.address, permissionsRoot)
            const kernelAcl = ACL.at(await kernelNoProxy.acl())
            const r = await kernelNoProxy.APP_MANAGER_ROLE()
            await kernelAcl.createPermission(permissionsRoot, kernelNoProxy.address, r, permissionsRoot)
        })

        it('fails trying to set app because of no proxy', async () => {
            return assertRevert(async () => {
                await kernelNoProxy.setApp(APP_BASE_NAMESPACE, appId, appCode1.address)
            })
        })
    })
})
