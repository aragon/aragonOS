const ScriptHelpers = artifacts.require('ScriptHelpers')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    await deployer.deploy(ScriptHelpers)
    await deployer.link(ScriptHelpers, EVMScriptRegistryFactory)
  })
}
