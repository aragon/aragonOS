var DAO = artifacts.require('DAO')
var MetaOrgan = artifacts.require('MetaOrgan')
var Application = artifacts.require('Application')

const appNames = ['BylawsApp', 'OwnershipApp', 'VotingApp', 'StatusApp']

let nonce = 0
const { getNonce, signatures } = require('../test/helpers/web3')

const liveNetworks = ['kovan', 'ropsten']

module.exports = (deployer, network) => {
  let dao, meta = {}
  let bylawsAddress = ''

  const isLive = liveNetworks.indexOf(network) > -1

  const installApp = (app, i) => {
    nonce += 1

    const params = isLive ? { nonce } : {}
    const sigs = signatures(app, [Application], web3)

    console.log('Installing app', app.constructor._json.contract_name, app.address)
    return meta.installApp(app.address, sigs, params)
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
      meta = MetaOrgan.at(dao.address)
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
      return meta.setPermissionsOracle(bylawsAddress)
    })
}
