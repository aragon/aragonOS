var DAO = artifacts.require('DAO')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var Application = artifacts.require('Application')

const appNames = ['BylawsApp', 'OwnershipApp', 'VotingApp', 'StatusApp']

const deployApps = daoAddress => {
  const appsDeploy = appNames
                      .map(n => artifacts.require(n))
                      .map(appContract => appContract.new(daoAddress))

  return Promise.all(appsDeploy)
}

module.exports = (deployer) => {
  let dao, dao_apps = {}

  const installApp = (app, i) => {
    const n = i + 1
    console.log('Installing app', app.constructor._json.contract_name, app.address, 'at slot', n)
    return dao_apps.installApp(n, app.address)
  }

  return deployer
    .then(() => DAO.deployed())
    .then(d => {
      dao = d
      dao_apps = ApplicationOrgan.at(dao.address)

      return deployApps(dao.address)
    })
    .then(deployedApps => Promise.all(deployedApps.map(installApp)))
}
