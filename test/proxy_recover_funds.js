const { assertRevert } = require('./helpers/assertThrow')
const { skipCoverage } = require('./helpers/coverage')
const { onlyIf } = require('./helpers/onlyIf')
const { getBalance } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')

const DAOFactory = artifacts.require('DAOFactory')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const ACL = artifacts.require('ACL')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')

// Mocks
const AppStub = artifacts.require('AppStub')
const AppStubConditionalRecovery = artifacts.require('AppStubConditionalRecovery')
const StandardTokenMock = artifacts.require('StandardTokenMock')
const VaultMock = artifacts.require('VaultMock')

const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event == event)[0].args[arg] }

const APP_ID = hash('stub.aragonpm.test')

contract('Proxy funds', accounts => {
  let aclBase, appBase, appConditionalRecoveryBase
  let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE, ETH

  const permissionsRoot = accounts[0]

  // Helpers
  const recoverEth = async (target, vault) => {
    const amount = 1
    const initialBalance = await getBalance(target.address)
    const initialVaultBalance = await getBalance(vault.address)
    const r = await target.sendTransaction({ value: 1, gas: 31000 })
    assert.equal((await getBalance(target.address)).valueOf(), initialBalance.plus(amount))
    await target.transferToVault(ETH)
    assert.equal((await getBalance(target.address)).valueOf(), 0)
    assert.equal((await getBalance(vault.address)).valueOf(), initialVaultBalance.plus(initialBalance).plus(amount).valueOf())
  }

  const recoverTokens = async (target, vault) => {
    const amount = 1
    const token = await StandardTokenMock.new(accounts[0], 1000)
    const initialBalance = await token.balanceOf(target.address)
    const initialVaultBalance = await token.balanceOf(vault.address)
    await token.transfer(target.address, amount)
    assert.equal((await token.balanceOf(target.address)).valueOf(), initialBalance.plus(amount))
    await target.transferToVault(token.address)
    assert.equal((await token.balanceOf(target.address)).valueOf(), 0)
    assert.equal((await token.balanceOf(vault.address)).valueOf(), initialVaultBalance.plus(initialBalance).plus(amount).valueOf())
  }

  const failWithoutVault = async (target, kernel) => {
    const amount = 1
    const vaultId = hash('vaultfake.aragonpm.test')
    const initialBalance = await getBalance(target.address)
    await kernel.setRecoveryVaultId(vaultId)
    const r = await target.sendTransaction({ value: 1, gas: 31000 })
    assert.equal((await getBalance(target.address)).valueOf(), initialBalance.plus(amount))
    return assertRevert(async () => {
      await target.transferToVault(ETH)
    })
  }

  // Initial setup
  before(async () => {
    aclBase = await ACL.new()
    appBase = await AppStub.new()
    appConditionalRecoveryBase = await AppStubConditionalRecovery.new()

    // Setup constants
    const kernel = await Kernel.new(true)
    APP_BASES_NAMESPACE = await kernel.APP_BASES_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernel.APP_ADDR_NAMESPACE()
    ETH = await kernel.ETH()
  })

  // Test both the Kernel itself and the KernelProxy to make sure their behaviours are the same
  for (const kernelType of ['Kernel', 'KernelProxy']) {
    const onlyBaseKernel = onlyIf(() => kernelType === 'Kernel')
    const onlyKernelProxy = onlyIf(() => kernelType === 'KernelProxy')

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

        await kernel.initialize(aclBase.address, permissionsRoot);
        const acl = ACL.at(await kernel.acl())
        const r = await kernel.APP_MANAGER_ROLE()
        await acl.createPermission(permissionsRoot, kernel.address, r, permissionsRoot)
      })

      // Test both the Vault itself and when it's behind a proxy to make sure their recovery behaviours are the same
      for (const vaultType of ['Vault', 'VaultProxy']) {
        const skipCoverageIfVaultProxy = test => {
          // The VaultMock isn't instrumented during coverage, but the AppProxy is, and so
          // transferring to the fallback fails when we're testing with the proxy.
          // Native transfers (either .send() or .transfer()) fail under coverage because they're
          // limited to 2.3k gas, and the injected instrumentation from coverage makes these
          // operations cost more than that limit.
          return vaultType === 'VaultProxy' ? skipCoverage(test) : test
        }

        context(`> ${vaultType}`, () => {
          let target, vault

          beforeEach(async () => {
            const vaultId = hash('vault.aragonpm.test')
            const vaultBase = await VaultMock.new()

            if (vaultType === 'Vault') {
              vault = vaultBase
            } else if (vaultType === 'VaultProxy') {
              // This doesn't automatically setup the recovery address
              const receipt = await kernel.newAppInstance(vaultId, vaultBase.address)
              const vaultProxyAddress = getEvent(receipt, 'NewAppProxy', 'proxy')
              vault = VaultMock.at(vaultProxyAddress)
            }
            await kernel.setApp(APP_ADDR_NAMESPACE, vaultId, vault.address)
            await kernel.setRecoveryVaultId(vaultId)
          })

          onlyBaseKernel(() => {
            context('> Base kernel', () => {
              it('cannot receive ETH', skipCoverageIfVaultProxy(async () =>
                await assertRevert(
                  () => kernel.sendTransaction({ value: 1, gas: 31000 })
                )
              ))

              it('recovers tokens', async () => {
                await recoverTokens(kernel, vault)
              })
            })
          })

          onlyKernelProxy(() => {
            context('> KernelProxy', () => {
              beforeEach(() => {
                target = kernel
              })

              it('recovers ETH', skipCoverageIfVaultProxy(async () =>
                await recoverEth(target, vault)
              ))

              it('recovers tokens', async () => {
                await recoverTokens(target, vault)
              })

              it('fails if vault is not contract', async () => {
                await failWithoutVault(target, kernel)
              })
            })
          })

          context('> App without kernel', () => {
            beforeEach(async () => {
              target = await AppStub.new()
            })

            it('does not recover ETH', skipCoverageIfVaultProxy(async () =>
              await assertRevert(
                () => recoverEth(target, vault)
              )
            ))

            it('does not recover tokens', async () =>
              await assertRevert(
                () => recoverTokens(target, vault)
              )
            )
          })

          context('> Proxied app with kernel', () => {
            beforeEach(async () => {
              // Setup app
              const receipt = await kernel.newAppInstance(APP_ID, appBase.address)
              const appProxy = getEvent(receipt, 'NewAppProxy', 'proxy')
              target = AppStub.at(appProxy)
            })

            it('cannot sent 0 ETH to proxy', async () => {
              await assertRevert(async () => {
                await target.sendTransaction({ value: 0, gas: 31000 })
              })
            })

            it('cannot sent ETH with data to proxy', async () => {
              await assertRevert(async () => {
                await target.sendTransaction({ value: 1, data: '0x1', gas: 31000 })
              })
            })

            it('recovers ETH', skipCoverageIfVaultProxy(
              async () => await recoverEth(target, vault)
            ))

            it('recovers tokens', async () => {
              await recoverTokens(target, vault)
            })

            it('fails if vault is not contract', async () => {
              await failWithoutVault(target, kernel)
            })
          })

          context('> Conditional fund recovery', () => {
            beforeEach(async () => {
              // Setup app with conditional recovery code
              const receipt = await kernel.newAppInstance(APP_ID, appConditionalRecoveryBase.address)
              const appProxy = getEvent(receipt, 'NewAppProxy', 'proxy')
              target = AppStub.at(appProxy)
            })

            it('does not allow recovering ETH', skipCoverageIfVaultProxy(
              // Conditional stub doesnt allow eth recoveries
              () => assertRevert(
                () => recoverEth(target, vault)
              )
            ))

            it('allows recovering tokens', async () => {
              await recoverTokens(target, vault)
            })
          })
        })
      }
    })
  }
})
