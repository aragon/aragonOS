var DAO = artifacts.require('DAO')
var MetaOrgan = artifacts.require('MetaOrgan')
var TokensOrgan = artifacts.require('TokensOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')

const organs = [VaultOrgan, TokensOrgan, ActionsOrgan, ApplicationOrgan]

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

module.exports = (deployer) => {
  let dao = {}

  return deployer.deploy(DAO, { gas: 4e6 })
    .then(() => {
      dao = MetaOrgan.at(DAO.address)

      const firstOrgan = 3
      let currentNonce = 0

      const installOrgan = (organ, i) => {
        const n = i + firstOrgan
        console.log('Installing', organ.constructor._json.contract_name, organ.address, 'at slot', n)
        currentNonce += 1

        return dao.installOrgan(organ.address, n, { nonce: currentNonce + i + 1 })
      }

      return getNonce().then(x => {
        const installOrgans = Promise.all(organs.map((organ, i) => {
          currentNonce = x + i
          return organ.new({ nonce: currentNonce })
        }))
          .then(x => Promise.all(x.map(installOrgan)))
        return installOrgans
      })
    })
}
