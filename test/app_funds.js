const { hash } = require('eth-ens-namehash')
const { assertRevert } = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')
const { onlyIf } = require('./helpers/onlyIf')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppProxyPinned = artifacts.require('AppProxyPinned')

// Mocks
const AppStub = artifacts.require('AppStub')
const UnsafeAppStub = artifacts.require('UnsafeAppStub')
const AppStubDepositable = artifacts.require('AppStubDepositable')
const UnsafeAppStubDepositable = artifacts.require('UnsafeAppStubDepositable')

const APP_ID = hash('stub.aragonpm.test')
const EMPTY_BYTES = '0x'
const SEND_ETH_GAS = 31000 // 21k base tx cost + 10k limit on depositable proxies

contract('App funds', accounts => {
  let aclBase, kernelBase
  let APP_BASES_NAMESPACE

  const permissionsRoot = accounts[0]

  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()

    // Setup constants
    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
  })

  const appBases = [
    {
      base: AppStub,
      unsafeBase: UnsafeAppStub,
    },
    {
      base: AppStubDepositable,
      unsafeBase: UnsafeAppStubDepositable,
    }
  ]
  for ({ base: appBaseType, unsafeBase: unsafeAppBaseType } of appBases) {
    context(`> ${appBaseType.contractName}`, () => {
      const onlyAppStubDepositable = onlyIf(() => appBaseType === AppStubDepositable)

      // Test the app itself and when it's behind the proxies to make sure their behaviours are the same
      const appProxyTypes = ['AppProxyUpgradeable', 'AppProxyPinned']
      for (const appType of ['App', ...appProxyTypes]) {
        context(`> ${appType}`, () => {
          let appBase, app

          before(async () => {
            if (appProxyTypes.includes(appType)) {
              // We can reuse the same app base for the proxies
              appBase = await appBaseType.new()
            }
          })

          beforeEach(async () => {
            const kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
            await kernel.initialize(aclBase.address, permissionsRoot)

            if (appType === 'App') {
              // Use the unsafe version to use directly without a proxy
              app = await unsafeAppBaseType.new(kernel.address)
            } else {
              // Install app
              const acl = ACL.at(await kernel.acl())
              const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
              await acl.createPermission(permissionsRoot, kernel.address, APP_MANAGER_ROLE, permissionsRoot)
              await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase.address)

              let appProxy
              if (appType === 'AppProxyUpgradeable') {
                appProxy = await AppProxyUpgradeable.new(kernel.address, APP_ID, EMPTY_BYTES)
              } else if (appType === 'AppProxyPinned') {
                appProxy = await AppProxyPinned.new(kernel.address, APP_ID, EMPTY_BYTES)
              }

              app = appBaseType.at(appProxy.address)
            }

            await app.initialize();
          })

          it('cannot receive ETH', async () => {
            assert.isTrue(await app.hasInitialized(), 'should have been initialized')

            await assertRevert(async () => {
              await app.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
            })
          })

          onlyAppStubDepositable(() => {
            it('does not have depositing enabled by default', async () => {
              assert.isTrue(await app.hasInitialized(), 'should have been initialized')
              assert.isFalse(await app.isDepositable(), 'should not be depositable')
            })

            it('can receive ETH after being set to depositable', async () => {
              const amount = 1
              const initialBalance = await getBalance(app.address)

              await app.enableDeposits()
              assert.isTrue(await app.isDepositable(), 'should be depositable')

              await app.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
              assert.equal((await getBalance(app.address)).valueOf(), initialBalance.plus(amount))
            })
          })
        })
      }
    })
  }
})
