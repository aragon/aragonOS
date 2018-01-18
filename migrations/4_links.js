const ScriptHelpers = artifacts.require('ScriptHelpers')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

module.exports = async (deployer, network) => {
    deployer.deploy(ScriptHelpers)
    deployer.link(ScriptHelpers, EVMScriptRegistryFactory)
}
