const assertEvent = require('./helpers/assertEvent')
const { assertRevert } = require('./helpers/assertThrow')
const { getBlockNumber } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

// Mocks
const AppStub = artifacts.require('AppStub')
const APP_ID = hash('stub.aragonpm.test')
const VAULT_ID = hash('vault.aragonpm.test')

contract('Kernel lifecycle', accounts => {
  let aclBase, appBase
  let DEFAULT_ACL_APP_ID, APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE, APP_MANAGER_ROLE

  const testUnaccessibleFunctionalityWhenUninitialized = async (kernel) => {
    // hasPermission should always return false when uninitialized
    assert.isFalse(await kernel.hasPermission(accounts[0], kernel.address, APP_MANAGER_ROLE))
    assert.isFalse(await kernel.hasPermission(accounts[1], kernel.address, APP_MANAGER_ROLE))

    await assertRevert(() => kernel.newAppInstance(APP_ID, appBase.address, '0x', false))
    await assertRevert(() => kernel.newPinnedAppInstance(APP_ID, appBase.address, '0x', false))
    await assertRevert(() => kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase.address))
    await assertRevert(() => kernel.setRecoveryVaultAppId(VAULT_ID))
  }

  const testUsability = async (kernel) => {
    // Make sure we haven't already setup the required permission
    assert.isFalse(await kernel.hasPermission(accounts[0], kernel.address, APP_MANAGER_ROLE))
    assert.isFalse(await kernel.hasPermission(accounts[1], kernel.address, APP_MANAGER_ROLE))

    // Then set the required permission
    const acl = ACL.at(await kernel.acl())
    await acl.createPermission(accounts[0], kernel.address, APP_MANAGER_ROLE, accounts[0])
    assert.isTrue(await kernel.hasPermission(accounts[0], kernel.address, APP_MANAGER_ROLE))
    assert.isFalse(await kernel.hasPermission(accounts[1], kernel.address, APP_MANAGER_ROLE))

    // And finally test functionality
    await kernel.newAppInstance(APP_ID, appBase.address, '0x', false)
  }

  // Initial setup
  before(async () => {
    aclBase = await ACL.new()
    appBase = await AppStub.new()

    // Setup constants
    const kernel = await Kernel.new(true)
    DEFAULT_ACL_APP_ID = await kernel.DEFAULT_ACL_APP_ID()
    APP_BASES_NAMESPACE = await kernel.APP_BASES_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernel.APP_ADDR_NAMESPACE()
    APP_MANAGER_ROLE = await kernel.APP_MANAGER_ROLE()
  })

  context('> Kernel base', () => {
    context('> Petrified', () => {
      let kernelBase

      beforeEach(async () => {
        kernelBase = await Kernel.new(true) // petrify immediately
      })

      it('is not initialized', async () => {
        assert.isFalse(await kernelBase.hasInitialized(), 'should not be initialized')
      })

      it('is petrified', async () => {
        assert.isTrue(await kernelBase.isPetrified(), 'should be petrified')
      })

      it('throws on initialization', async () => {
        await assertRevert(async () => {
          await kernelBase.initialize(accounts[0], accounts[0])
        })
      })

      it('should not be usable', async () => {
        await testUnaccessibleFunctionalityWhenUninitialized(kernelBase)
      })
    })

    context('> Directly used', () => {
      let kernel

      beforeEach(async () => {
        kernel = await Kernel.new(false) // allow base to be used directly
      })

      it('is not initialized by default', async () => {
        assert.isFalse(await kernel.hasInitialized(), 'should not be initialized')
      })

      it('is not petrified by default', async () => {
        assert.isFalse(await kernel.isPetrified(), 'should not be petrified')
      })

      it('is initializable and usable', async () => {
        await kernel.initialize(aclBase.address, accounts[0])
        assert.isTrue(await kernel.hasInitialized(), 'should be initialized')
        assert.isFalse(await kernel.isPetrified(), 'should not be petrified')

        await testUsability(kernel)
      })
    })
  })

  context('> KernelProxy', () => {
    let kernelBase, kernel

    before(async () => {
      kernelBase = await Kernel.new(true) // petrify immediately
    })

    beforeEach(async () => {
      const kernelProxy = await KernelProxy.new(kernelBase.address)
      kernel = Kernel.at(kernelProxy.address)
    })

    it('is not initialized by default', async () => {
      assert.isFalse(await kernel.hasInitialized(), 'should not be initialized')
    })

    it('is not petrified by default', async () => {
      assert.isFalse(await kernel.isPetrified(), 'should not be petrified')
    })

    it('should not be usable yet', async () => {
      await testUnaccessibleFunctionalityWhenUninitialized(kernel)
    })

    context('> Initialized', () => {
      let initReceipt

      beforeEach(async () => {
        initReceipt = await kernel.initialize(aclBase.address, accounts[0])
        acl = ACL.at(await kernel.acl())
      })

      it('set the ACL correctly', async () => {
        assertEvent(initReceipt, 'SetApp', 2)
        const setAppLogs = initReceipt.logs.filter(l => l.event == 'SetApp')
        const ACLBaseLog = setAppLogs[0]
        const ACLAppLog = setAppLogs[1]

        assert.equal(ACLBaseLog.args.namespace, APP_BASES_NAMESPACE, 'should set base acl first')
        assert.equal(ACLBaseLog.args.appId, DEFAULT_ACL_APP_ID, 'should set base acl first')
        assert.equal(ACLBaseLog.args.app, aclBase.address, 'should set base acl first')
        assert.equal(ACLAppLog.args.namespace, APP_ADDR_NAMESPACE, 'should set default acl second')
        assert.equal(ACLAppLog.args.appId, DEFAULT_ACL_APP_ID, 'should set default acl second')
        assert.equal(ACLAppLog.args.app, acl.address, 'should set default acl second')
      })

      it('is now initialized', async () => {
        assert.isTrue(await kernel.hasInitialized(), 'should be initialized')
      })

      it('is still not petrified', async () => {
        assert.isFalse(await kernel.isPetrified(), 'should not be petrified')
      })

      it('has correct initialization block', async () => {
        assert.equal(await kernel.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
      })

      it('throws on reinitialization', async () => {
        return assertRevert(async () => {
          await kernel.initialize(accounts[0], accounts[0])
        })
      })

      it('should now be usable', async () => {
        await testUsability(kernel)
      })
    })
  })
})
