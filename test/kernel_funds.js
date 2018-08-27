const { assertRevert } = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

const SEND_ETH_GAS = 31000 // 21k base tx cost + 10k limit on depositable proxies

contract('Kernel funds', accounts => {
  let aclBase
  const permissionsRoot = accounts[0]

  // Initial setup
  before(async () => {
    aclBase = await ACL.new()
  })

  // Test both the Kernel itself and the KernelProxy to make sure their behaviours are the same
  for (const kernelType of ['Kernel', 'KernelProxy']) {
    context(`> ${kernelType}`, () => {
      let kernelBase, kernel

      before(async () => {
        if (kernelType === 'KernelProxy') {
          // We can reuse the same kernel base for the proxies
          kernelBase = await Kernel.new(true) // petrify immediately
        }
      })

      beforeEach(async () => {
        if (kernelType === 'Kernel') {
          kernel = await Kernel.new(false) // don't petrify so it can be used
        } else if (kernelType === 'KernelProxy') {
          kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
        }
      })

      it('cannot receive ETH before being initialized', async () => {
        assert.isFalse(await kernel.hasInitialized(), 'should not have been initialized')
        assert.isFalse(await kernel.isDepositable(), 'should not be depositable')

        await assertRevert(async () => {
          await kernel.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
        })
      })

      it('can receive ETH after being initialized', async () => {
        const amount = 1
        const initialBalance = await getBalance(kernel.address)

        await kernel.initialize(aclBase.address, permissionsRoot);
        assert.isTrue(await kernel.hasInitialized(), 'should have been initialized')
        assert.isTrue(await kernel.isDepositable(), 'should be depositable')

        await kernel.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
        assert.equal((await getBalance(kernel.address)).valueOf(), initialBalance.plus(amount))
      })
    })
  }
})
