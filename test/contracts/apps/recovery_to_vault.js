const { hash } = require('eth-ens-namehash')
const { assertAmountOfEvents, assertEvent } = require('../../helpers/assertEvent')(web3)
const { assertRevert } = require('../../helpers/assertThrow')
const { getNewProxyAddress } = require('../../helpers/events')
const { getBalance } = require('../../helpers/web3')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

// Mocks
const AppStubDepositable = artifacts.require('AppStubDepositable')
const AppStubConditionalRecovery = artifacts.require('AppStubConditionalRecovery')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')
const TokenReturnFalseMock = artifacts.require('TokenReturnFalseMock')
const TokenReturnMissingMock = artifacts.require('TokenReturnMissingMock')
const VaultMock = artifacts.require('VaultMock')
const KernelDepositableMock = artifacts.require('KernelDepositableMock')

const APP_ID = hash('stub.aragonpm.test')
const EMPTY_BYTES = '0x'
const TX_BASE_GAS = 21000
const SEND_ETH_GAS = TX_BASE_GAS + 9999 // <10k gas is the threshold for depositing

contract('Recovery to vault', ([permissionsRoot]) => {
  let aclBase, appBase, appConditionalRecoveryBase
  let APP_ADDR_NAMESPACE, ETH

  // Helpers
  const recoverEth = async ({ shouldFail, target, vault }) => {
    const amount = 1
    const initialBalance = await getBalance(target.address)
    const initialVaultBalance = await getBalance(vault.address)
    await target.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
    assert.equal((await getBalance(target.address)).valueOf(), initialBalance.plus(amount), 'Target initial balance should be correct')

    const recoverAction = () => target.transferToVault(ETH)

    if (shouldFail) {
      await assertRevert(recoverAction)
      assert.equal((await getBalance(target.address)).valueOf(), initialBalance.plus(amount), 'Target balance should be same as before')
      assert.equal((await getBalance(vault.address)).valueOf(), initialVaultBalance, 'Vault balance should should be same as before')
    } else {
      const recoverReceipt = await recoverAction()
      assert.equal((await getBalance(target.address)).valueOf(), 0, 'Target balance should be 0')
      assert.equal((await getBalance(vault.address)).valueOf(), initialVaultBalance.plus(initialBalance).plus(amount), 'Vault balance should include recovered amount')

      assertAmountOfEvents(recoverReceipt, 'RecoverToVault')
      assertEvent(recoverReceipt, 'RecoverToVault', { vault: vault.address, token: ETH, amount: amount })
    }
  }

  const recoverTokens = async ({ shouldFail, tokenContract, target, vault }) => {
    const amount = 1
    const token = await tokenContract.new(permissionsRoot, 1000)
    const initialBalance = await token.balanceOf(target.address)
    const initialVaultBalance = await token.balanceOf(vault.address)
    await token.transfer(target.address, amount)
    assert.equal((await token.balanceOf(target.address)).valueOf(), initialBalance.plus(amount), 'Target initial balance should be correct')

    const recoverAction = () => target.transferToVault(token.address)

    if (shouldFail) {
      await assertRevert(recoverAction)
      assert.equal((await token.balanceOf(target.address)).valueOf(), initialBalance.plus(amount), 'Target balance should be same as before')
      assert.equal((await token.balanceOf(vault.address)).valueOf(), initialVaultBalance, 'Vault balance should should be same as before')
    } else {
      const recoverReceipt = await recoverAction()
      assert.equal((await token.balanceOf(target.address)).valueOf(), 0, 'Target balance should be 0')
      assert.equal((await token.balanceOf(vault.address)).valueOf(), initialVaultBalance.plus(initialBalance).plus(amount), 'Vault balance should include recovered amount')

      assertAmountOfEvents(recoverReceipt, 'RecoverToVault')
      assertEvent(recoverReceipt, 'RecoverToVault', { vault: vault.address, token: token.address, amount: amount })
    }
  }

  const failingRecoverTokens = async ({ tokenContract, target, vault }) => {
    const amount = 1
    const token = await tokenContract.new(permissionsRoot, 1000)
    const initialBalance = await token.balanceOf(target.address)
    const initialVaultBalance = await token.balanceOf(vault.address)
    await token.transfer(target.address, amount)
    assert.equal((await token.balanceOf(target.address)).valueOf(), initialBalance.plus(amount), 'Target initial balance should be correct')

    // Stop token from being transferable
    await token.setAllowTransfer(false)

    // Try to transfer
    await assertRevert(target.transferToVault(token.address))

    assert.equal((await token.balanceOf(target.address)).valueOf(), initialBalance.plus(amount), 'Target balance should be same as before')
    assert.equal((await token.balanceOf(vault.address)).valueOf(), initialVaultBalance, 'Vault balance should should be same as before')
  }

  const failWithoutVault = async (target, kernel) => {
    const amount = 1
    const vaultId = hash('vaultfake.aragonpm.test')
    const initialBalance = await getBalance(target.address)
    await kernel.setRecoveryVaultAppId(vaultId)
    const r = await target.sendTransaction({ value: 1, gas: SEND_ETH_GAS })
    assert.equal((await getBalance(target.address)).valueOf(), initialBalance.plus(amount), 'Target initial balance should be correct')
    await assertRevert(target.transferToVault(ETH))
  }

  // Token test groups
  const tokenTestGroups = [
    {
      title: 'standards compliant, reverting token',
      tokenContract: TokenMock,
    },
    {
      title: 'standards compliant, non-reverting token',
      tokenContract: TokenReturnFalseMock,
    },
    {
      title: 'non-standards compliant, missing return token',
      tokenContract: TokenReturnMissingMock,
    },
  ]

  // Initial setup
  before(async () => {
    aclBase = await ACL.new()
    appBase = await AppStubDepositable.new()
    appConditionalRecoveryBase = await AppStubConditionalRecovery.new()

    // Setup constants
    const kernel = await Kernel.new(true)
    APP_ADDR_NAMESPACE = await kernel.APP_ADDR_NAMESPACE()

    const etherTokenConstantMock = await EtherTokenConstantMock.new()
    ETH = await etherTokenConstantMock.getETHConstant()
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

        await kernel.initialize(aclBase.address, permissionsRoot)
        const acl = ACL.at(await kernel.acl())
        const r = await kernel.APP_MANAGER_ROLE()
        await acl.createPermission(permissionsRoot, kernel.address, r, permissionsRoot)
      })

      // Test both the Vault itself and when it's behind a proxy to make sure their recovery behaviours are the same
      for (const vaultType of ['Vault', 'VaultProxy']) {
        context(`> ${vaultType}`, () => {
          let target, vault

          beforeEach(async () => {
            const vaultId = hash('vault.aragonpm.test')
            const vaultBase = await VaultMock.new()

            if (vaultType === 'Vault') {
              vault = vaultBase
            } else if (vaultType === 'VaultProxy') {
              // This doesn't automatically setup the recovery address
              const receipt = await kernel.newAppInstance(vaultId, vaultBase.address, EMPTY_BYTES, false)
              const vaultProxyAddress = getNewProxyAddress(receipt)
              vault = VaultMock.at(vaultProxyAddress)
            }
            await vault.initialize()

            await kernel.setApp(APP_ADDR_NAMESPACE, vaultId, vault.address)
            await kernel.setRecoveryVaultAppId(vaultId)
          })

          it('kernel cannot receive ETH', async () =>
            await assertRevert(kernel.sendTransaction({ value: 1, gas: 31000 }))
          )

          for (const { title, tokenContract } of tokenTestGroups) {
            it(`kernel recovers ${title}`, async () => {
              await recoverTokens({
                tokenContract,
                vault,
                target: kernel
              })
            })

            it(`kernel reverts on failing recovery for ${title}`, async () => {
              await failingRecoverTokens({
                tokenContract,
                vault,
                target: kernel,
              })
            })
          }

          context('> App without kernel', () => {
            beforeEach(async () => {
              target = await AppStubDepositable.new()
              await target.enableDeposits()
            })

            it('does not recover ETH', async () =>
              await recoverEth({ target, vault, shouldFail: true })
            )

            it('does not recover tokens', async () =>
              await recoverTokens({
                target,
                vault,
                shouldFail: true,
                tokenContract: TokenMock,
              })
            )
          })

          context('> Proxied app with kernel', () => {
            beforeEach(async () => {
              // Setup app
              const receipt = await kernel.newAppInstance(APP_ID, appBase.address, EMPTY_BYTES, false)
              const appProxy = getNewProxyAddress(receipt)
              const app = AppStubDepositable.at(appProxy)
              await app.enableDeposits()

              target = app
            })

            it('cannot send 0 ETH to proxy', async () => {
              await assertRevert(target.sendTransaction({ value: 0, gas: SEND_ETH_GAS }))
            })

            it('cannot send ETH with data to proxy', async () => {
              await assertRevert(target.sendTransaction({ value: 1, data: '0x01', gas: SEND_ETH_GAS }))
            })

            it('recovers ETH', async () =>
              await recoverEth({ target, vault })
            )

            for (const { title, tokenContract } of tokenTestGroups) {
              it(`recovers ${title}`, async () => {
                await recoverTokens({
                  tokenContract,
                  target,
                  vault,
                })
              })

              it(`reverts on failing recovery for ${title}`, async () => {
                await failingRecoverTokens({
                  tokenContract,
                  target,
                  vault,
                })
              })
            }

            it('fails if vault is not contract', async () => {
              await failWithoutVault(target, kernel)
            })
          })

          context('> Conditional fund recovery', () => {
            beforeEach(async () => {
              // Setup app with conditional recovery code
              const receipt = await kernel.newAppInstance(APP_ID, appConditionalRecoveryBase.address, EMPTY_BYTES, false)
              const appProxy = getNewProxyAddress(receipt)
              const app = AppStubConditionalRecovery.at(appProxy)
              await app.initialize()

              target = app
            })

            it('does not allow recovering ETH', async () =>
              // Conditional stub doesnt allow eth recoveries
              await recoverEth({ target, vault, shouldFail: true })
            )

            for (const { title, tokenContract } of tokenTestGroups) {
              it(`allows recovers ${title}`, async () => {
                await recoverTokens({
                  tokenContract,
                  target,
                  vault,
                })
              })

              it(`reverts on failing recovery for ${title}`, async () => {
                await failingRecoverTokens({
                  tokenContract,
                  target,
                  vault,
                })
              })
            }
          })
        })
      }
    })
  }

  // Kernel is not depositable by default, but in order to test transferToVault,
  // we create a mockup to make it depositable
  context('Depositable KernelProxy', async () => {
    let kernel, vault

    beforeEach(async () => {
      const kernelBase = await KernelDepositableMock.new(true) // petrify immediately
      const kernelProxy = await KernelProxy.new(kernelBase.address)
      const aclBase = await ACL.new()
      kernel = KernelDepositableMock.at(kernelProxy.address)
      await kernel.initialize(aclBase.address, permissionsRoot)
      await kernel.enableDeposits()
      const acl = ACL.at(await kernel.acl())
      const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
      await acl.createPermission(permissionsRoot, kernel.address, APP_MANAGER_ROLE, permissionsRoot, { from: permissionsRoot })

      // Create a new vault and set that vault as the default vault in the kernel
      const vaultId = hash('vault.aragonpm.test')
      const vaultBase = await VaultMock.new()
      const vaultReceipt = await kernel.newAppInstance(vaultId, vaultBase.address, EMPTY_BYTES, true)
      const vaultAddress = getNewProxyAddress(vaultReceipt)
      vault = VaultMock.at(vaultAddress)
      await vault.initialize()

      await kernel.setRecoveryVaultAppId(vaultId)
    })

    it('recovers ETH from the kernel', async () => {
      await recoverEth({ target: kernel, vault })
    })
  })
})