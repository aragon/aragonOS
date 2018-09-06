const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    withEvmScripts = true,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const ACL = artifacts.require('ACL')
  const Kernel = artifacts.require('Kernel')

  const DAOFactory = artifacts.require('DAOFactory')

  log('Deploying DAOFactory with bases...')
  const kernelBase = await Kernel.new(true) // immediately petrify
  const aclBase = await ACL.new()
  let evmScriptRegistryFactory
  if (withEvmScripts) {
    const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
    evmScriptRegistryFactory = await EVMScriptRegistryFactory.new()
  }
  const daoFactory = await DAOFactory.new(
    kernelBase.address,
    aclBase.address,
    evmScriptRegistryFactory ? evmScriptRegistryFactory.address : '0x00'
  )
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
