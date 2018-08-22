const { assertRevert } = require('./helpers/assertThrow')
const { skipCoverage } = require('./helpers/coverage')
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

contract('Proxy funds', accounts => {
  let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE
  let kernel, kernelProxy, app, appProxy, ETH

  const permissionsRoot = accounts[0]
  const appId = hash('stub.aragonpm.test')
  const zeroAddr = '0x0000000000000000000000000000000000000000'

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

  const failWithoutVault = async (target, vault) => {
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

  beforeEach(async () => {
    const kernelBase = await Kernel.new()
    const aclBase = await ACL.new()

    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernelBase.APP_ADDR_NAMESPACE()

    const factory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x00')

    app = await AppStub.new()

    const receipt = await factory.newDAO(permissionsRoot)
    const kernelAddress = getEvent(receipt, 'DeployDAO', 'dao')

    kernel = Kernel.at(kernelAddress)
    kernelProxy = KernelProxy.at(kernelAddress)
    const acl = ACL.at(await kernel.acl())

    const r = await kernel.APP_MANAGER_ROLE()
    await acl.createPermission(permissionsRoot, kernel.address, r, permissionsRoot)

    // app
    await kernel.setApp(APP_BASES_NAMESPACE, appId, app.address)
    const initializationPayload = app.contract.initialize.getData()
    appProxy = await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload, { gas: 6e6 })

    ETH = await kernel.ETH()
  })

  // Test both the Vault itself and when it's behind a proxy to make sure their recovery behaviours are the same
  for (const vaultTestType of ['Vault', 'VaultProxy']) {
    const skipCoverageIfVaultProxy = test => {
      // The VaultMock isn't instrumented during coverage, but the AppProxy is, and so transferring
      // to the fallback fails when we're testing with the proxy
      return vaultTestType === 'VaultProxy' ? skipCoverage(test) : test
    }

    context(`> ${vaultTestType}`, () => {
      let target, vault

      beforeEach(async () => {
        const vaultId = hash('vault.aragonpm.test')
        const vaultBase = await VaultMock.new()

        if (vaultTestType === 'Vault') {
          vault = vaultBase
        } else if (vaultTestType === 'VaultProxy') {
          // This doesn't automatically set up the recovery address
          const receipt = await kernel.newAppInstance(vaultId, vaultBase.address)
          const vaultProxyAddress = getEvent(receipt, 'NewAppProxy', 'proxy')
          vault = VaultMock.at(vaultProxyAddress)
        }
        await kernel.setApp(APP_ADDR_NAMESPACE, vaultId, vault.address)
        await kernel.setRecoveryVaultId(vaultId)
      })

      context('> App without kernel', async () => {
        beforeEach(() => {
          target = app
        })

        it('does not recover ETH', skipCoverageIfVaultProxy(() =>
          assertRevert(
            () => recoverEth(target, vault)
          )
        ))

        it('does not recover tokens', () =>
          assertRevert(
            () => recoverTokens(target, vault)
          )
        )
      })

      context('> Proxied app with kernel', async () => {
        beforeEach(() => {
          target = AppStub.at(appProxy.address)
        })

        it('recovers ETH', skipCoverageIfVaultProxy(
          async () => await recoverEth(target, vault)
        ))

        it('recovers tokens', async () => {
          await recoverTokens(target, vault)
        })

        it('fails if vault is not contract', async () => {
          await failWithoutVault(target, vault)
        })
      })

      context('> Conditional fund recovery', async () => {
        let conditionalRecoveryAppCode

        before(async () => {
          conditionalRecoveryAppCode = await AppStubConditionalRecovery.new()
        })

        beforeEach(async () => {
          // upgrade app to stub with conditional recovery code
          await kernel.setApp(APP_BASES_NAMESPACE, appId, conditionalRecoveryAppCode.address)
          target = AppStub.at(appProxy.address)
        })

        it('does not allow recovering ETH', skipCoverageIfVaultProxy(
          // conditional stub doesnt allow eth recoveries
          () => assertRevert(
            () => recoverEth(target, vault)
          )
        ))

        it('allows recovering tokens', async () => {
          await recoverTokens(target, vault)
        })
      })

      context('> Kernel without proxy', async () => {
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
          await failWithoutVault(target, vault)
        })
      })

      context('> Kernel Proxy', async () => {
        beforeEach(() => {
          target = Kernel.at(kernelProxy.address)
        })

        it('recovers ETH', skipCoverageIfVaultProxy(async () =>
          await recoverEth(target, vault)
        ))

        it('recovers tokens', async () => {
          await recoverTokens(target, vault)
        })

        it('fails if vault is not contract', async () => {
          await failWithoutVault(target, vault)
        })
      })
    })
  }
})
