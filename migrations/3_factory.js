module.exports = async (deployer, network, accounts, arts = null) => {
  if (arts != null) artifacts = arts // allow running outside

  const DAOFactory = artifacts.require('DAOFactory')
  const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

  const regFact = await EVMScriptRegistryFactory.new()
  const daoFact = await DAOFactory.new(regFact.address)

  if (!arts) { // Running standalone in aOS repo
    const receipt = await daoFact.newDAO(accounts[0])
    daoAddr = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao
    console.log('deployed DAO at', daoAddr)
  }

  return { daoFact }
}
