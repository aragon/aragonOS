const { assertRevert } = require('./helpers/assertThrow')
const { onlyIf } = require('./helpers/onlyIf')
const { getBalance } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppProxyPinned = artifacts.require('AppProxyPinned')

// Mocks
const AppStub = artifacts.require('AppStub')
const AppStub2 = artifacts.require('AppStub2')
const ERCProxyMock = artifacts.require('ERCProxyMock')
const KernelOverloadMock = artifacts.require('KernelOverloadMock')

const APP_ID = hash('stub.aragonpm.test')
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES = '0x'

contract('Kernel apps', accounts => {
    let aclBase, appBase1, appBase2
    let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE, APP_MANAGER_ROLE
    let UPGRADEABLE, FORWARDING

    const permissionsRoot = accounts[0]

    // Initial setup
    before(async () => {
        aclBase = await ACL.new()
        appBase1 = await AppStub.new()
        appBase2 = await AppStub2.new()

        // Setup constants
        const kernel = await Kernel.new(true)
        APP_BASES_NAMESPACE = await kernel.APP_BASES_NAMESPACE()
        APP_ADDR_NAMESPACE = await kernel.APP_ADDR_NAMESPACE()
        APP_MANAGER_ROLE = await kernel.APP_MANAGER_ROLE()

        const ercProxyMock = await ERCProxyMock.new()
        UPGRADEABLE = (await ercProxyMock.UPGRADEABLE()).toString()
        FORWARDING = (await ercProxyMock.FORWARDING()).toString()
    })

    // Test both the Kernel itself and the KernelProxy to make sure their behaviours are the same
    for (const kernelType of ['Kernel', 'KernelProxy']) {
        context(`> ${kernelType}`, () => {
            let acl, kernel, kernelBase, app, appProxy

            before(async () => {
                if (kernelType === 'KernelProxy') {
                    // We can reuse the same kernel base for the proxies
                    kernelBase = await Kernel.new(true) // petrify immediately
                }
            })

            beforeEach(async () => {
                if (kernelType === 'Kernel') {
                    kernel = await Kernel.new(false)  // don't petrify so it can be used
                } else if (kernelType === 'KernelProxy') {
                    kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
                }

                await kernel.initialize(aclBase.address, permissionsRoot);
                acl = ACL.at(await kernel.acl())
                await acl.createPermission(permissionsRoot, kernel.address, APP_MANAGER_ROLE, permissionsRoot)
            })

            /********
            * TESTS *
            *********/
            it('fails if setting app to 0 address', async () => {
                return assertRevert(async () => {
                    await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, ZERO_ADDR)
                })
            })

            it('fails if setting app to non-contract address', async () => {
                return assertRevert(async () => {
                    await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, '0x1234')
                })
            })

            const newAppProxyMapping = {
                'AppProxy': 'newAppInstance',
                'AppProxyPinned': 'newPinnedAppInstance',
            }
            for (const appProxyType of Object.keys(newAppProxyMapping)) {
                // NOTE: we have to do really hacky workarounds here due to truffle not supporting
                // function overloads.
                // Especially awful is how we only get the full version of `newAppInstance()` but
                // not `newPinnedAppInstance()`, forcing us to apply the KernelOverloadMock on
                // different proxy instances
                let kernelOverload
                const newInstanceFn = newAppProxyMapping[appProxyType]

                const onlyAppProxy = onlyIf(() => appProxyType === 'AppProxy')
                const onlyAppProxyPinned = onlyIf(() => appProxyType === 'AppProxyPinned')

                context(`> new ${appProxyType} instances`, () => {
                    onlyAppProxy(() =>
                        it('creates a new upgradeable app proxy instance', async () => {
                            const receipt = await kernel.newAppInstance(APP_ID, appBase1.address, '0x', false)
                            const appProxy = AppProxyUpgradeable.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
                            assert.equal(await appProxy.kernel(), kernel.address, "new appProxy instance's kernel should be set to the originating kernel")

                            // Checks ERC897 functionality
                            assert.equal((await appProxy.proxyType()).toString(), UPGRADEABLE, 'new appProxy instance should be upgradeable')
                            assert.equal(await appProxy.implementation(), appBase1.address, 'new appProxy instance should be resolving to implementation address')
                        })
                    )

                    onlyAppProxyPinned(() =>
                        it('creates a new non upgradeable app proxy instance', async () => {
                            const receipt = await kernel.newPinnedAppInstance(APP_ID, appBase1.address, '0x', false)
                            const appProxy = AppProxyPinned.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
                            assert.equal(await appProxy.kernel(), kernel.address, "new appProxy instance's kernel should be set to the originating kernel")

                            // Checks ERC897 functionality
                            assert.equal((await appProxy.proxyType()).toString(), FORWARDING, 'new appProxy instance should be not upgradeable')
                            assert.equal(await appProxy.implementation(), appBase1.address, 'new appProxy instance should be resolving to implementation address')
                        })
                    )

                    context('> full new app instance overload', async () => {
                        beforeEach(async () => {
                            if (appProxyType === 'AppProxy') {
                                // No need to apply the overload
                                kernelOverload = kernel
                            } else if (appProxyType === 'AppProxyPinned') {
                                kernelOverload = await KernelOverloadMock.new(kernel.address)
                                await acl.grantPermission(kernelOverload.address, kernel.address, APP_MANAGER_ROLE)
                            }
                        })

                        it('sets the app base when not previously registered', async() => {
                            assert.equal(ZERO_ADDR, await kernel.getApp(APP_BASES_NAMESPACE, APP_ID))

                            await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', false)
                            assert.equal(appBase1.address, await kernel.getApp(APP_BASES_NAMESPACE, APP_ID))
                        })

                        it("doesn't set the app base when already set", async() => {
                            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase1.address)
                            const receipt = await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', false)
                            assert.isFalse(receipt.logs.includes(l => l.event == 'SetApp'))
                        })

                        it("also sets the default app", async () => {
                            const receipt = await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', true)
                            const appProxyAddr = receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy

                            // Check that both the app base and default app are set
                            assert.equal(await kernel.getApp(APP_BASES_NAMESPACE, APP_ID), appBase1.address, 'App base should be set')
                            assert.equal(await kernel.getApp(APP_ADDR_NAMESPACE, APP_ID), appProxyAddr, 'Default app should be set')

                            // Make sure app is not initialized
                            assert.isFalse(await AppStub.at(appProxyAddr).hasInitialized(), "App shouldn't have been initialized")
                        })

                        it("allows initializing proxy", async () => {
                            const initData = appBase1.initialize.request().params[0].data

                            const receipt = await kernelOverload[newInstanceFn](APP_ID, appBase1.address, initData, false)
                            const appProxyAddr = receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy

                            // Make sure app was initialized
                            // assert.isTrue(await AppStub.at(appProxyAddr).hasInitialized(), 'App should have been initialized')

                            // Check that the app base has been set, but the app isn't the default app
                            assert.equal(await kernel.getApp(APP_BASES_NAMESPACE, APP_ID), appBase1.address, 'App base should be set')
                            assert.equal(await kernel.getApp(APP_ADDR_NAMESPACE, APP_ID), ZERO_ADDR, "Default app shouldn't be set")
                        })

                        it("fails if the app base is not given", async() => {
                            return assertRevert(async () => {
                                await kernelOverload[newInstanceFn](APP_ID, ZERO_ADDR, '0x', false)
                            })
                        })

                        it('fails if the given app base is different than the existing one', async() => {
                            const existingBase = appBase1.address
                            const differentBase = appBase2.address
                            assert.notEqual(existingBase, differentBase, 'appBase1 and appBase2 should have different addresses')

                            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, existingBase)
                            return assertRevert(async () => {
                                await kernelOverload[newInstanceFn](APP_ID, differentBase, '0x', false)
                            })
                        })
                    })

                    context('> minimized new app instance overload', async () => {
                        beforeEach(async () => {
                            if (appProxyType === 'AppProxy') {
                                kernelOverload = await KernelOverloadMock.new(kernel.address)
                                await acl.grantPermission(kernelOverload.address, kernel.address, APP_MANAGER_ROLE)
                            } else if (appProxyType === 'AppProxyPinned') {
                                // No need to apply the overload
                                kernelOverload = kernel
                            }
                        })

                        it('sets the app base when not previously registered', async() => {
                            assert.equal(ZERO_ADDR, await kernel.getApp(APP_BASES_NAMESPACE, APP_ID))

                            await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', false)
                            assert.equal(appBase1.address, await kernel.getApp(APP_BASES_NAMESPACE, APP_ID))
                        })

                        it("doesn't set the app base when already set", async() => {
                            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase1.address)
                            const receipt = await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', false)
                            assert.isFalse(receipt.logs.includes(l => l.event == 'SetApp'))
                        })

                        it("does not set the default app", async () => {
                            const receipt = await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', false)
                            const appProxyAddr = receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy

                            // Check that only the app base is set
                            assert.equal(await kernel.getApp(APP_BASES_NAMESPACE, APP_ID), appBase1.address, 'App base should be set')
                            assert.equal(await kernel.getApp(APP_ADDR_NAMESPACE, APP_ID), ZERO_ADDR, "Default app shouldn't be set")

                            // Make sure app is not initialized
                            assert.isFalse(await AppStub.at(appProxyAddr).hasInitialized(), "App shouldn't have been initialized")
                        })

                        it("does not allow initializing proxy", async () => {
                            const initData = appBase1.initialize.request().params[0].data

                            const receipt = await kernelOverload[newInstanceFn](APP_ID, appBase1.address, '0x', false)
                            const appProxyAddr = receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy

                            // Make sure app was not initialized
                            assert.isFalse(await AppStub.at(appProxyAddr).hasInitialized(), 'App should have been initialized')

                            // Check that the app base has been set, but the app isn't the default app
                            assert.equal(await kernel.getApp(APP_BASES_NAMESPACE, APP_ID), appBase1.address, 'App base should be set')
                            assert.equal(await kernel.getApp(APP_ADDR_NAMESPACE, APP_ID), ZERO_ADDR, "Default app shouldn't be set")
                        })

                        it("fails if the app base is not given", async() => {
                            return assertRevert(async () => {
                                await kernelOverload[newInstanceFn](APP_ID, ZERO_ADDR, '0x', false)
                            })
                        })

                        it('fails if the given app base is different than the existing one', async() => {
                            const existingBase = appBase1.address
                            const differentBase = appBase2.address
                            assert.notEqual(existingBase, differentBase, 'appBase1 and appBase2 should have different addresses')

                            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, existingBase)
                            return assertRevert(async () => {
                                await kernelOverload[newInstanceFn](APP_ID, differentBase, '0x', false)
                            })
                        })
                    })
                })
            }
        })
    }
})
