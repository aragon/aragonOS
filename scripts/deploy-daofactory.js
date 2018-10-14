const logDeploy = require('./helpers/create-logger')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    withEvmScriptRegistryFactory = true,
    verbose = true
  } = {}
) => {
  const ACL = artifacts.require('ACL')
  const Kernel = artifacts.require('Kernel')

  const DAOFactory = artifacts.require('DAOFactory')

  const kernelBase = await Kernel.new(true) // immediately petrify
  logDeploy(kernelBase, verbose)

  const aclBase = await ACL.new()
  logDeploy(aclBase, verbose)

  let evmScriptRegistryFactory
  if (withEvmScriptRegistryFactory) {
    const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
    evmScriptRegistryFactory = await EVMScriptRegistryFactory.new()
    logDeploy(evmScriptRegistryFactory, verbose)
  }
  const daoFactory = await DAOFactory.new(
    kernelBase.address,
    aclBase.address,
    evmScriptRegistryFactory ? evmScriptRegistryFactory.address : ZERO_ADDR
  )

  logDeploy(daoFactory, verbose)

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
