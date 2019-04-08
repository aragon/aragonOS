const { assertRevert } = require('./helpers/assertThrow')
const { onlyIf } = require('./helpers/onlyIf')
const { getBlockNumber } = require('./helpers/web3')
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
const KernelSetAppMock = artifacts.require('KernelSetAppMock')

const APP_ID = hash('stub.aragonpm.test')
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES = '0x'

contract('App proxy', accounts => {
  let aclBase, appBase1, appBase2, kernelBase, acl, kernel
  let APP_BASES_NAMESPACE, APP_ROLE
  let UPGRADEABLE, FORWARDING

  const permissionsRoot = accounts[0]

  // Initial setup
  before(async () => {
    appBase1 = await AppStub.new()
    appBase2 = await AppStub2.new()

    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()

    // Setup constants
    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    APP_ROLE = await appBase1.ROLE()

    const ercProxyMock = await ERCProxyMock.new()
    UPGRADEABLE = (await ercProxyMock.UPGRADEABLE()).toString()
    FORWARDING = (await ercProxyMock.FORWARDING()).toString()
  })

  beforeEach(async () => {
    kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
    await kernel.initialize(aclBase.address, permissionsRoot)
    acl = ACL.at(await kernel.acl())

    // Set up app management permissions
    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(permissionsRoot, kernel.address, APP_MANAGER_ROLE, permissionsRoot)
  })

  const appProxyContractMapping = {
    'AppProxyUpgradeable': AppProxyUpgradeable,
    'AppProxyPinned': AppProxyPinned,
  }
  for (const appProxyType of Object.keys(appProxyContractMapping)) {
    const appProxyContract = appProxyContractMapping[appProxyType]

    const onlyAppProxyUpgradeable = onlyIf(() => appProxyType === 'AppProxyUpgradeable')
    const onlyAppProxyPinned = onlyIf(() => appProxyType === 'AppProxyPinned')

    context(`> ${appProxyType}`, () => {
      let app

      // Suite of basic tests for each proxy type
      checkProxyType = () => {
        it('checks ERC897 functions', async () => {
          const proxy = appProxyContract.at(app.address)
          const implementation = await proxy.implementation()
          assert.equal(implementation, appBase1.address, 'app address should match base')

          const proxyType = (await proxy.proxyType()).toString()

          if (appProxyType === 'AppProxyUpgradeable') {
            assert.equal(proxyType, UPGRADEABLE, 'proxy type should be upgradeable')
          } else if (appProxyType === 'AppProxyPinned') {
            assert.equal(proxyType, FORWARDING, 'proxy type should be forwarding')
          }
        })

        if (appProxyType === 'AppProxyUpgradeable') {
          it('is upgradeable', async () => {
            const proxy = appProxyContract.at(app.address)
            assert.equal((await proxy.proxyType()).toString(), UPGRADEABLE, 'app should be upgradeable')
          })
        } else if (appProxyType === 'AppProxyPinned') {
          it('is not upgradeable', async () => {
            const proxy = appProxyContract.at(app.address)
            assert.notEqual((await proxy.proxyType()).toString(), UPGRADEABLE, 'app should not be upgradeable')
          })
        }
      }

      onlyAppProxyUpgradeable(() => {
        it("allows creating proxy if code hasn't been set and not initializing on constructor", async () => {
          await AppProxyUpgradeable.new(kernel.address, APP_ID, EMPTY_BYTES)
        })

        it('fails if initializing on constructor before setting app code', async () => {
          const initializationPayload = appBase1.contract.initialize.getData()

          return assertRevert(async () => {
            await AppProxyUpgradeable.new(kernel.address, APP_ID, initializationPayload)
          })
        })
      })

      onlyAppProxyPinned(() => {
        const FAKE_APP_ID = hash('fake.aragonpm.test')

        it("fails if code hasn't been set yet", async () => {
          await assertRevert(async () => {
            await AppProxyPinned.new(kernel.address, FAKE_APP_ID, EMPTY_BYTES)
          })
        })

        it("fails if code set isn't a contract", async () => {
          const kernelMock = await KernelSetAppMock.new()
          await kernelMock.setApp(APP_BASES_NAMESPACE, FAKE_APP_ID, '0x1234')

          await assertRevert(async () => {
            await AppProxyPinned.new(kernelMock.address, FAKE_APP_ID, EMPTY_BYTES)
          })
        })
      })

      context('> Fails on bad kernel', () => {
        it('fails if kernel address is 0', async () => {
          return assertRevert(async () => {
            await appProxyContract.new(ZERO_ADDR, APP_ID, EMPTY_BYTES)
          })
        })

        it('fails if kernel address is not a contract', async () => {
          return assertRevert(async () => {
            await appProxyContract.new('0x1234', APP_ID, EMPTY_BYTES)
          })
        })
      })

      context('> Initialized on proxy constructor', () => {
        beforeEach(async () => {
          await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase1.address)

          const initializationPayload = appBase1.contract.initialize.getData()
          const appProxy = await appProxyContract.new(kernel.address, APP_ID, initializationPayload)
          app = AppStub.at(appProxy.address)
        })

        // Run generic checks for proxy type
        checkProxyType()

        it('is initialized', async () => {
          assert.isTrue(await app.hasInitialized(), 'app should have been initialized')
        })

        it('is not petrified', async () => {
          assert.isFalse(await app.isPetrified(), 'app should not have been petrified')
        })

        it('has correct initialization block', async () => {
            assert.equal(await app.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
        })

        it('cannot reinitialize', async () => {
          return assertRevert(async () => {
            await app.initialize()
          })
        })

        it('fails if init fails', async () => {
          const badInit = '0x1234'
          return assertRevert(async () => {
            await appProxyContract.new(kernel.address, APP_ID, badInit)
          })
        })

        it('should return values correctly', async () => {
          assert.equal(await app.stringTest(), 'hola', 'string test')
        })
      })

      context('> Not initialized on proxy constructor', () => {
        beforeEach(async () => {
          await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase1.address)

          const initializationPayload = EMPTY_BYTES // don't initialize
          const appProxy = await appProxyContract.new(kernel.address, APP_ID, initializationPayload)
          app = AppStub.at(appProxy.address)
        })

        // Run generic checks for proxy type
        checkProxyType()

        it('is not initialized', async () => {
          assert.isFalse(await app.hasInitialized(), 'app should not have been initialized')
          assert.isFalse(await app.isPetrified(), 'app should not have been petrified')
        })

        it('can initialize', async () => {
          await app.initialize()
          assert.isTrue(await app.hasInitialized(), 'app should have been initialized')
          assert.isFalse(await app.isPetrified(), 'app should not have been petrified')
        })

        it("fails calling functionality requiring initialization (if it's not)", async () => {
          return assertRevert(async () => {
            await app.requiresInitialization()
          })
        })

        it('allows calling functionality requiring initialization after initializing', async () => {
          await app.initialize()
          const result = await app.requiresInitialization()
          assert.equal(result, true, "should return correct result")
        })
      })

      context('> Updating app', () => {
        beforeEach(async () => {
          await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase1.address)

          const initializationPayload = appBase1.contract.initialize.getData()
          const appProxy = await appProxyContract.new(kernel.address, APP_ID, initializationPayload)
          app = AppStub.at(appProxy.address)

          // Assign app permissions
          await acl.createPermission(permissionsRoot, appProxy.address, APP_ROLE, permissionsRoot)
        })

        onlyAppProxyUpgradeable(() => {
          it('storage is preserved', async () => {
            await app.setValue(10)
            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase2.address)

            // The upgraded app (AppStub2) returns the double of the value in storage
            assert.equal(await app.getValue(), 20, 'app should have returned correct value after upgrading')
          })

          it('removed functions throw', async () => {
            await app.setValue(10)
            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase2.address)

            // The upgraded app (AppStub2) doesn't have `setValue()` anymore
            return assertRevert(async () => {
              await app.setValue(10)
            })
          })
        })

        onlyAppProxyPinned(() =>
          it('can update app code and pinned proxy continues using former version', async () => {
            await app.setValue(10)
            await app.setValue(11)
            await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase2.address)

            // The upgraded app (AppStub2) would return the double of the value in storage
            assert.equal(await app.getValue(), 11, 'app should have returned correct original value')
          })
        )
      })
    })
  }
})
