const { assertRevert } = require('../../helpers/assertThrow')
const { onlyIf } = require('../../helpers/onlyIf')
const { getBalance } = require('../../helpers/web3')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

// Mocks
const KernelDepositableMock = artifacts.require('KernelDepositableMock')

const TX_BASE_GAS = 21000
const SEND_ETH_GAS = TX_BASE_GAS + 9999 // <10k gas is the threshold for depositing

contract('Kernel funds', ([permissionsRoot]) => {
  let aclBase

  // Initial setup
  before(async () => {
    aclBase = await ACL.new()
  })

  for (const kernelBaseType of [Kernel, KernelDepositableMock]) {
    context(`> ${kernelBaseType.contractName}`, () => {
      const onlyKernelDepositable = onlyIf(() => kernelBaseType === KernelDepositableMock)

      // Test both the base itself and the KernelProxy to make sure their behaviours are the same
      for (const kernelType of ['Base', 'Proxy']) {
        context(`> ${kernelType}`, () => {
          let kernelBase, kernel

          before(async () => {
            if (kernelType === 'Proxy') {
              // We can reuse the same kernel base for the proxies
              kernelBase = await kernelBaseType.new(true) // petrify immediately
            }
          })

          beforeEach(async () => {
            if (kernelType === 'Base') {
              kernel = await kernelBaseType.new(false) // don't petrify so it can be used
            } else if (kernelType === 'Proxy') {
              kernel = kernelBaseType.at((await KernelProxy.new(kernelBase.address)).address)
            }
          })

          it('cannot receive ETH', async () => {
            // Before initialization
            assert.isFalse(await kernel.hasInitialized(), 'should not have been initialized')

            await assertRevert(kernel.sendTransaction({ value: 1, gas: SEND_ETH_GAS }))

            // After initialization
            await kernel.initialize(aclBase.address, permissionsRoot)
            assert.isTrue(await kernel.hasInitialized(), 'should have been initialized')

            await assertRevert(kernel.sendTransaction({ value: 1, gas: SEND_ETH_GAS }))
          })

          onlyKernelDepositable(() => {
            it('does not have depositing enabled by default', async () => {
              // Before initialization
              assert.isFalse(await kernel.hasInitialized(), 'should not have been initialized')
              assert.isFalse(await kernel.isDepositable(), 'should not be depositable')

              // After initialization
              await kernel.initialize(aclBase.address, permissionsRoot)
              assert.isTrue(await kernel.hasInitialized(), 'should have been initialized')
              assert.isFalse(await kernel.isDepositable(), 'should not be depositable')
            })

            it('can receive ETH after being enabled', async () => {
              const amount = 1
              const initialBalance = await getBalance(kernel.address)

              await kernel.initialize(aclBase.address, permissionsRoot)
              await kernel.enableDeposits()
              assert.isTrue(await kernel.hasInitialized(), 'should have been initialized')
              assert.isTrue(await kernel.isDepositable(), 'should be depositable')

              await kernel.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
              assert.equal((await getBalance(kernel.address)).valueOf(), initialBalance.plus(amount))
            })
          })
        })
      }
    })
  }
})
