const { assertRevert } = require('./helpers/assertThrow')
const { onlyIf } = require('./helpers/onlyIf')
const { getBalance } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')
const { soliditySha3 } = require('web3-utils')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppProxyPinned = artifacts.require('AppProxyPinned')

// Mocks
const AppStub = artifacts.require('AppStub')
const AppStub2 = artifacts.require('AppStub2')
const ERCProxyMock = artifacts.require('ERCProxyMock')
const KernelMock = artifacts.require('KernelMock')

const APP_ID = hash('stub.aragonpm.test')
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES = '0x'

contract('Kernel apps', accounts => {
    let aclBase, appBase1, appBase2
    let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE
    let APP_SET_ID, APP_DEFAULT_ID
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
        APP_SET_ID = soliditySha3(APP_BASES_NAMESPACE, APP_ID)
        APP_DEFAULT_ID = soliditySha3(APP_ADDR_NAMESPACE, APP_ID)

        const ercProxyMock = await ERCProxyMock.new()
        UPGRADEABLE = (await ercProxyMock.UPGRADEABLE()).toString()
        FORWARDING = (await ercProxyMock.FORWARDING()).toString()
    })

    // Test both the Kernel itself and the KernelProxy to make sure their behaviours are the same
    for (const kernelType of ['Kernel', 'KernelProxy']) {
        context(`> ${kernelType}`, () => {
            let acl, kernel, kernelBase, app, appProxy

            const withAppManagerPermission = async (contractAddr, fn) => {
                await acl.grantPermission(contractAddr, kernel.address, APP_MANAGER_ROLE)
                const ret = await fn()
                await acl.revokePermission(contractAddr, kernel.address, APP_MANAGER_ROLE)

                return ret
            }

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
                const newInstanceFn = newAppProxyMapping[appProxyType]

                const onlyAppProxy = onlyIf(() => appProxyType === 'AppProxy')
                const onlyAppProxyPinned = onlyIf(() => appProxyType === 'AppProxyPinned')

                context(`> new ${appProxyType} instances`, () => {
                    onlyAppProxy(() =>
                        it('creates a new upgradeable app proxy instance', async () => {
                            const receipt = await kernel.newAppInstance(APP_ID, appBase1.address)
                            const appProxy = AppProxyUpgradeable.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
                            assert.equal(await appProxy.kernel(), kernel.address, "new appProxy instance's kernel should be set to the originating kernel")

                            // Checks ERC897 functionality
                            assert.equal((await appProxy.proxyType.call()).toString(), UPGRADEABLE, 'new appProxy instance should be upgradeable')
                            assert.equal(await appProxy.implementation(), appBase1.address, 'new appProxy instance should be resolving to implementation address')
                        })
                    )

                    onlyAppProxyPinned(() =>
                        it('creates a new non upgradeable app proxy instance', async () => {
                            const receipt = await kernel.newPinnedAppInstance(APP_ID, appBase1.address)
                            const appProxy = AppProxyPinned.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
                            assert.equal(await appProxy.kernel(), kernel.address, "new appProxy instance's kernel should be set to the originating kernel")

                            // Checks ERC897 functionality
                            assert.equal((await appProxy.proxyType.call()).toString(), FORWARDING, 'new appProxy instance should be not upgradeable')
                            assert.equal(await appProxy.implementation(), appBase1.address, 'new appProxy instance should be resolving to implementation address')
                        })
                    )

                    it('sets the app base when not previously registered', async() => {
                        assert.equal(ZERO_ADDR, await kernel.getApp(APP_SET_ID))

                        await kernel[newInstanceFn](APP_ID, appBase1.address)
                        assert.equal(appBase1.address, await kernel.getApp(APP_SET_ID))
                    })

                    it("doesn't set the app base when already set", async() => {
                        await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase1.address)
                        const receipt = await kernel[newInstanceFn](APP_ID, appBase1.address)
                        assert.isFalse(receipt.logs.includes(l => l.event == 'SetApp'))
                    })

                    it("also sets the default app when using the overloaded version", async () => {
                        let appProxyAddr

                        // Create KernelMock instance so we can use the overloaded version
                        const kernelMock = await KernelMock.new(kernel.address)

                        await withAppManagerPermission(kernelMock.address, async () => {
                            const receipt = await kernelMock[newInstanceFn](APP_ID, appBase1.address, true)
                            appProxyAddr = receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy
                        })

                        // Check that both the app base and default app are set
                        assert.equal(await kernel.getApp(APP_SET_ID), appBase1.address)
                        assert.equal(await kernel.getApp(APP_DEFAULT_ID), appProxyAddr)
                    })

                    it("fails if the app base is not given", async() => {
                        return assertRevert(async () => {
                            await kernel[newInstanceFn](APP_ID, ZERO_ADDR)
                        })
                    })

                    it('fails if the given app base is different than the existing one', async() => {
                        const existingBase = appBase1.address
                        const differentBase = appBase2.address
                        assert.notEqual(existingBase, differentBase, 'appBase1 and appBase2 should have different addresses')

                        await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, existingBase)
                        return assertRevert(async () => {
                            await kernel[newInstanceFn](APP_ID, differentBase)
                        })
                    })
                })
            }
        })
    }
})
