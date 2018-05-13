const { assertRevert } = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')
const { hash } = require('eth-ens-namehash')

const Kernel = artifacts.require('Kernel')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const AppStub = artifacts.require('AppStub')
const AppStubConditionalRecovery = artifacts.require('AppStubConditionalRecovery')
const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')

const getContract = artifacts.require
const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event == event)[0].args[arg] }
const keccak256 = require('js-sha3').keccak_256
const APP_BASES_NAMESPACE = '0x'+keccak256('base')

contract('Proxy funds', accounts => {
  let factory, acl, kernel, kernelProxy, app, appProxy, ETH, vault, target

  const permissionsRoot = accounts[0]
  const appId = hash('stub.aragonpm.test')
  const zeroAddr = '0x0000000000000000000000000000000000000000'

  beforeEach(async () => {
    const kernelBase = await getContract('Kernel').new()
    const aclBase = await getContract('ACL').new()
    factory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x00')

    app = await AppStub.new()

    const receipt = await factory.newDAO(permissionsRoot)
    const kernelAddress = getEvent(receipt, 'DeployDAO', 'dao')

    kernel = Kernel.at(kernelAddress)
    kernelProxy = getContract('KernelProxy').at(kernelAddress)
    acl = ACL.at(await kernel.acl())

    const r = await kernel.APP_MANAGER_ROLE()
    await acl.createPermission(permissionsRoot, kernel.address, r, permissionsRoot)

    // app
    await kernel.setApp(APP_BASES_NAMESPACE, appId, app.address)
    const initializationPayload = app.contract.initialize.getData()
    appProxy = await AppProxyUpgradeable.new(kernel.address, appId, initializationPayload, { gas: 6e6 })

    ETH = await kernel.ETH()

    // vault
    const vaultBase = await getContract('VaultMock').new()
    const vaultId = hash('vault.aragonpm.test')
    const kernelMock = await getContract('KernelMock').new(kernel.address)
    await acl.grantPermission(kernelMock.address, kernel.address, r)
    const vaultReceipt = await kernelMock.newAppInstance(vaultId, vaultBase.address, true)
    await acl.revokePermission(kernelMock.address, kernel.address, r)
    const vaultProxyAddress = getEvent(vaultReceipt, 'NewAppProxy', 'proxy')
    vault = getContract('VaultMock').at(vaultProxyAddress)
    await kernel.setRecoveryVaultId(vaultId)
  })

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
    const token = await getContract('StandardTokenMock').new(accounts[0], 1000)
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

  context('App without kernel does not recover funds', async () => {
    beforeEach(() => {
      target = app
    })

    it('does not recover ETH', () => {
      return assertRevert(() => {
        return recoverEth(target, vault)
      })
    })

    it('does not recover tokens', async () => {
      return assertRevert(() => {
        return recoverTokens(target, vault)
      })
    })
  })

  context('Proxied app with kernel recovers funds', async () => {
    beforeEach(() => {
      target = AppStub.at(appProxy.address)
    })

    it('recovers ETH', async () => {
      await recoverEth(target, vault)
    })

    it('recovers tokens', async () => {
      await recoverTokens(target, vault)
    })

    it('fails if vault is not contract', async() => {
      await failWithoutVault(target, vault)
    })
  })

  context('Conditional fund recovery', async () => {
    let conditionalRecoveryAppCode

    before(async () => {
      conditionalRecoveryAppCode = await AppStubConditionalRecovery.new()
    })

    beforeEach(async () => {
      // upgrade app to stub with conditional recovery code
      await kernel.setApp(APP_BASES_NAMESPACE, appId, conditionalRecoveryAppCode.address)
      target = AppStub.at(appProxy.address)
    })

    it('doesnt allow to recovery ETH', async () => {
      // conditional stub doesnt allow eth recoveries
      return assertRevert(() => {
        return recoverEth(target, vault)
      })
    })

    it('allows to recover tokens', async () => {
      await recoverTokens(target, vault)
    })
  })

  context('Kernel without proxy recovers funds', async () => {
    beforeEach(() => {
      target = kernel
    })

    it('recovers ETH', async () => {
      await recoverEth(target, vault)
    })

    it('recovers tokens', async () => {
      await recoverTokens(target, vault)
    })

    it('fails if vault is not contract', async() => {
      await failWithoutVault(target, vault)
    })
  })

  context('Kernel Proxy recovers funds', async () => {
    beforeEach(() => {
      target = Kernel.at(kernelProxy.address)
    })

    it('recovers ETH', async () => {
      await recoverEth(target, vault)
    })

    it('recovers tokens', async () => {
      await recoverTokens(target, vault)
    })

    it('fails if vault is not contract', async() => {
      await failWithoutVault(target, vault)
    })
  })
})
