const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    verbose = true,
    withEvmScriptRegistryFactory = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const ACL = artifacts.require('ACL')
  const Kernel = artifacts.require('Kernel')

  const DAOFactory = artifacts.require('DAOFactory')
  const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

  log('Deploying DAOFactory with bases...')
  const kernelBase = await Kernel.new(true) // immediately petrify
  const aclBase = await ACL.new()
  let evmScriptRegistryFactoryAddress = ZERO_ADDR
  let evmScriptRegistryFactory
  if (withEvmScriptRegistryFactory) {
    evmScriptRegistryFactory = await EVMScriptRegistryFactory.new()
    evmScriptRegistryFactoryAddress = evmScriptRegistryFactory.address
  }
  const daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, evmScriptRegistryFactoryAddress)
  log('DAOFactory deployed:', daoFactory.address)

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
