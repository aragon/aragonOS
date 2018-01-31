const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

module.exports = async (deployer, network, accounts) => {
  const regFact = await EVMScriptRegistryFactory.new()
  const daoFact = await DAOFactory.new(regFact.address)
  const receipt = await daoFact.newDAO(accounts[0])

  daoAddr = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao

  // console.log('deployed DAO at', daoAddr)
}
