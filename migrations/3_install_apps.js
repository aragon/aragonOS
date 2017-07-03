var DAO = artifacts.require('DAO')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var MetaOrgan = artifacts.require('MetaOrgan')

const appNames = ['BylawsApp', 'OwnershipApp', 'VotingApp', 'StatusApp']

let nonce = 0
const getNonce = () => {
  return new Promise((resolve, reject) => {
    web3.eth.getAccounts((err, acc) => {
      if (err) return reject(err)
      web3.eth.getTransactionCount(acc[0], (err, n) => {
        if (err) return reject(err)
        resolve(n)
      })
    })
  })
}

const deployApps = (daoAddress, non) => {
  const appsDeploy = appNames
                      .map(n => artifacts.require(n))
                      .map((appContract, i) => appContract.new(daoAddress, { nonce: non + i }))

  return Promise.all(appsDeploy)
}

module.exports = (deployer) => {
  let dao, dao_apps = {}
  let bylawsAddress = ''

  const installApp = (app, i, non) => {
    const n = i + 1
    console.log('Installing app', app.constructor._json.contract_name, app.address, 'at slot', n)
    return dao_apps.installApp(n, app.address, { nonce: non + i })
  }

  return deployer
    .then(() => DAO.deployed())
    .then(d => {
      dao = d
      dao_apps = ApplicationOrgan.at(dao.address)
      return getNonce()
    })
    .then(x => {
      nonce = x
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
