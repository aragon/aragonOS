const { bn, onlyIf } = require('@aragon/contract-helpers-test')
const { assertBn, assertRevert } = require('@aragon/contract-helpers-test/src/asserts')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
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
              kernel = await kernelBaseType.at((await KernelProxy.new(kernelBase.address)).address)
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
              const amount = bn(1)
              const initialBalance = bn(await web3.eth.getBalance(kernel.address))

              await kernel.initialize(aclBase.address, permissionsRoot)
              await kernel.enableDeposits()
              assert.isTrue(await kernel.hasInitialized(), 'should have been initialized')
              assert.isTrue(await kernel.isDepositable(), 'should be depositable')

              await kernel.sendTransaction({ value: amount, gas: SEND_ETH_GAS })
              assertBn(bn(await web3.eth.getBalance(kernel.address)), initialBalance.add(amount))
            })
          })
        })
      }
    })
  }
})
