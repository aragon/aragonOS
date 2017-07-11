var DAO = artifacts.require('DAO')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var MetaOrgan = artifacts.require('MetaOrgan')

const appNames = ['BylawsApp', 'OwnershipApp', 'VotingApp', 'StatusApp', 'AccountingApp']

let nonce = 0
const { getNonce } = require('../test/helpers/web3')

const liveNetworks = ['kovan', 'ropsten']

module.exports = (deployer, network) => {
  let dao, dao_apps = {}
  let bylawsAddress = ''

  const isLive = liveNetworks.indexOf(network) > -1

  const installApp = (app, i) => {
    const n = i + 1
    nonce += 1

    const params = isLive ? { nonce } : {}
    console.log('Installing app', app.constructor._json.contract_name, app.address, 'at slot', n)
    return dao_apps.installApp(n, app.address, params)
  }

  const deployApps = daoAddress => {
    const appsDeploy = appNames
                        .map(n => artifacts.require(n))
                        .map((appContract, i) => {
                          nonce += 1
                          const params = isLive ? { nonce } : {}
                          return appContract.new(daoAddress, params)
                        })

    return Promise.all(appsDeploy)
  }

  return deployer
    .then(() => DAO.deployed())
    .then(d => {
      dao = d
      dao_apps = ApplicationOrgan.at(dao.address)
      return getNonce(web3)
    })
    .then(x => {
      nonce = x - 1
      return deployApps(dao.address, x)
    })
    .then(deployedApps => {
      bylawsAddress = deployedApps[0].address
      return Promise.all(deployedApps.map((x, i) => installApp(x, i, appNames.length + nonce)))
    })
    .then(() => {
      console.log('Setting BylawsApp as DAO permissions oracle')
      return MetaOrgan.at(dao.address).setPermissionsOracle(bylawsAddress)
    })
}
