const { assertRevert } = require('./helpers/assertThrow')
const { getBlockNumber } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')
const { soliditySha3 } = require('web3-utils')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

const AragonApp = artifacts.require('AragonApp')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')

// Mocks
const UnsafeAragonAppMock = artifacts.require('UnsafeAragonAppMock')

const APP_ID = hash('app.aragonpm.test')
const FAKE_ROLE = soliditySha3('FAKE_ROLE')
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract('App base lifecycle', accounts => {
  let aclBase, kernelBase
  const permissionsRoot = accounts[0]

  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
  })

  context('> AragonApp', () => {
    let app

    beforeEach(async () => {
      app = await AragonApp.new()
    })

    it('is not initialized', async () => {
      assert.isFalse(await app.hasInitialized(), 'should not be initialized')
    })

    it('is petrified', async () => {
      assert.isTrue(await app.isPetrified(), 'should be petrified')
    })

    it('does not have initialization function', async () => {
      assert.isNotFunction(app.initialize, 'base AragonApp should not have initialize')
    })

    it('should not be usable', async () => {
      assert.isFalse(await app.canPerform(permissionsRoot, FAKE_ROLE))
    })
  })

  context('> UnsafeAragonApp', () => {
    let app

    beforeEach(async () => {
      // Use the mock so we can initialize and set the kernel
      app = await UnsafeAragonAppMock.new()
    })

    it('is not initialized by default', async () => {
      assert.isFalse(await app.hasInitialized(), 'should not be initialized')
    })

    it('is not petrified by default', async () => {
      assert.isFalse(await app.isPetrified(), 'should not be petrified')
    })

    it('should not be usable yet', async () => {
      assert.isFalse(await app.canPerform(permissionsRoot, FAKE_ROLE))
    })

    context('> Initialized', () => {
      beforeEach(async () => {
        await app.initialize()
      })

      it('is now initialized', async () => {
        assert.isTrue(await app.hasInitialized(), 'should be initialized')
      })

      it('is still not petrified', async () => {
        assert.isFalse(await app.isPetrified(), 'should not be petrified')
      })

      it('has correct initialization block', async () => {
        assert.equal(await app.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
      })

      it('throws on reinitialization', async () => {
        return assertRevert(async () => {
          await app.initialize()
        })
      })

      it('should still not be usable without a kernel', async () => {
        assert.equal(await app.getKernel(), ZERO_ADDR, 'app should still be missing kernel reference')

        assert.isFalse(await app.canPerform(permissionsRoot, FAKE_ROLE))
      })

      context('> Set kernel', () => {
        let acl, kernel

        beforeEach(async () => {
          const kernelProxy = await KernelProxy.new(kernelBase.address)
          kernel = Kernel.at(kernelProxy.address)
          await kernel.initialize(aclBase.address, permissionsRoot)
          acl = ACL.at(await kernel.acl())

          await app.setKernelOnMock(kernel.address)
        })

        it('should not be usable if no permission is granted', async () => {
          assert.isFalse(await app.canPerform(permissionsRoot, FAKE_ROLE))
        })

        it('should be usable after initialization, setting a kernel, and setting a permission', async () => {
          // Setup permissions
          await acl.createPermission(permissionsRoot, app.address, FAKE_ROLE, permissionsRoot)

          assert.isTrue(await app.canPerform(permissionsRoot, FAKE_ROLE))
        })
      })
    })
  })
})
