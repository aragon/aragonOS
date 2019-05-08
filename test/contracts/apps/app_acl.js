const { hash } = require('eth-ens-namehash')
const { onlyIf } = require('../../helpers/onlyIf')
const { assertRevert } = require('../../helpers/assertThrow')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppProxyPinned = artifacts.require('AppProxyPinned')

// Mocks
const AppStub = artifacts.require('AppStub')
const UnsafeAppStub = artifacts.require('UnsafeAppStub')

const APP_ID = hash('stub.aragonpm.test')
const EMPTY_BYTES = '0x'

contract('App ACL', accounts => {
  let aclBase, kernelBase, acl, kernel
  let APP_BASES_NAMESPACE, APP_ROLE

  const permissionsRoot = accounts[0]
  const unauthorized = accounts[1]

  // Initial setup
  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()

    // Setup constants
    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()

    const app = await AppStub.new()
    APP_ROLE = await app.ROLE()
  })

  beforeEach(async () => {
    kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
    await kernel.initialize(aclBase.address, permissionsRoot)
    acl = ACL.at(await kernel.acl())

    // Set up app management permissions
    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(permissionsRoot, kernel.address, APP_MANAGER_ROLE, permissionsRoot)
  })

  // Test the app itself and when it's behind the proxies to make sure their behaviours are the same
  const appProxyTypes = ['AppProxyUpgradeable', 'AppProxyPinned']
  for (const appType of ['App', ...appProxyTypes]) {
    context(`> ${appType}`, () => {
      let appBase, app

      const onlyAppProxyUpgradeable = onlyIf(() => appType === 'AppProxyUpgradeable')

      before(async () => {
        if (appProxyTypes.includes(appType)) {
          // We can reuse the same app base for the proxies
          appBase = await AppStub.new()
        }
      })

      beforeEach(async () => {
        if (appType === 'App') {
          // Use the unsafe version to use directly without a proxy
          app = await UnsafeAppStub.new(kernel.address)
        } else {
          await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase.address)
          let appProxy
          if (appType === 'AppProxyUpgradeable') {
            appProxy = await AppProxyUpgradeable.new(kernel.address, APP_ID, EMPTY_BYTES)
          } else if (appType === 'AppProxyPinned') {
            appProxy = await AppProxyPinned.new(kernel.address, APP_ID, EMPTY_BYTES)
          }
          app = AppStub.at(appProxy.address)
        }

        await app.initialize()

        // assign app permissions
        await acl.createPermission(permissionsRoot, app.address, APP_ROLE, permissionsRoot)
      })

      it('should return values correctly', async () => {
        assert.equal(await app.stringTest(), 'hola', 'string test')
      })

      it('protected call works from authed entity', async () => {
        await app.setValue(10)
        assert.equal(await app.getValue(), 10, 'should have returned correct value')
      })

      it('parametrized call works from authed entity if no params set', async () => {
        await app.setValueParam(11)
        assert.equal(await app.getValue(), 11, 'should have returned correct value')
      })

      it('fails when called by unauthorized entity', async () => {
        await assertRevert(app.setValue(10, { from: unauthorized }))
      })

      onlyAppProxyUpgradeable(() =>
        it('fails if using app proxy without reference in kernel', async () => {
          const unknownId = hash('unknown.aragonpm.test')
          const appProxy = await AppProxyUpgradeable.new(kernel.address, unknownId, EMPTY_BYTES)
          const app = AppStub.at(appProxy.address)

          await assertRevert(app.setValue(10))
        })
      )

      context('> Parametrized calls', () => {
        const paramsGrantee = accounts[2]
        const paramValue = 5
        const succeedValue = paramValue + 1
        const failValue = paramValue - 1

        beforeEach(async () => {
          const argId = '0x00' // arg 0
          const op = '03'    // greater than
          const value = `00000000000000000000000000000000000000000000000000000000000${paramValue}` // 5
          const param = new web3.BigNumber(`${argId}${op}${value}`)

          await acl.grantPermissionP(paramsGrantee, app.address, APP_ROLE, [param], { from: permissionsRoot })
        })

        it('parametrized call succeeds if param eval succeeds', async () => {
          await app.setValueParam(succeedValue, { from: paramsGrantee })
        })

        it('parametrized call works from entity with no params set', async () => {
          // Fail value should still work for the entity who didn't have restrictions placed
          await app.setValueParam(failValue)
          assert.equal(await app.getValue(), failValue, 'should have returned correct value')
        })

        it('parametrized app call fails if param eval fails', async () => {
          await assertRevert(app.setValueParam(failValue, { from: paramsGrantee }))
        })
      })
    })
  }
})
