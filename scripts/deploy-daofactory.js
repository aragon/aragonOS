const logDeploy = require('./helpers/deploy-logger')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const defaultKernelBase = process.env.KERNEL_BASE
const defaultAclBaseAddress = process.env.ACL_BASE
const defaultEvmScriptRegistryFactoryAddress = process.env.EVM_REG_FACTORY

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    kernelBaseAddress = defaultKernelBase,
    aclBaseAddress = defaultAclBaseAddress,
    evmScriptRegistryFactoryAddress = defaultEvmScriptRegistryFactoryAddress,
    withEvmScriptRegistryFactory = true,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const ACL = artifacts.require('ACL')
  const Kernel = artifacts.require('Kernel')

  const DAOFactory = artifacts.require('DAOFactory')

  let kernelBase
  if (kernelBaseAddress) {
    kernelBase = Kernel.at(kernelBaseAddress)
    log(`Skipping deploying new Kernel base, using provided address: ${kernelBaseAddress}`)
  } else {
    kernelBase = await Kernel.new(true) // immediately petrify
    await logDeploy(kernelBase, { verbose })
  }

  let aclBase
  if (aclBaseAddress) {
    aclBase = ACL.at(aclBaseAddress)
    log(`Skipping deploying new ACL base, using provided address: ${aclBaseAddress}`)
  } else {
    aclBase = await ACL.new()
    await logDeploy(aclBase, { verbose })
  }

  let evmScriptRegistryFactory
  if (withEvmScriptRegistryFactory) {
    const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

    if (evmScriptRegistryFactoryAddress) {
      evmScriptRegistryFactory = EVMScriptRegistryFactory.at(evmScriptRegistryFactoryAddress)
      log(`Skipping deploying new EVMScriptRegistryFactory, using provided address: ${evmScriptRegistryFactoryAddress}`)
    } else {
      evmScriptRegistryFactory = await EVMScriptRegistryFactory.new()
      await logDeploy(evmScriptRegistryFactory, { verbose })
    }
  }
  const daoFactory = await DAOFactory.new(
    kernelBase.address,
    aclBase.address,
    evmScriptRegistryFactory ? evmScriptRegistryFactory.address : ZERO_ADDR
  )

  await logDeploy(daoFactory, { verbose })

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return {
      aclBase,
      daoFactory,
      evmScriptRegistryFactory,
      kernelBase,
    }
  }
}
