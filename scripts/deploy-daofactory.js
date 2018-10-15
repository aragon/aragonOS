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
  if (withEvmScriptRegistryFactory) {
    const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
    evmScriptRegistryFactory = await EVMScriptRegistryFactory.new()
  }
  const daoFactory = await DAOFactory.new(
    kernelBase.address,
    aclBase.address,
    evmScriptRegistryFactory ? evmScriptRegistryFactory.address : ZERO_ADDR
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
