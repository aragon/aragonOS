var DAO = artifacts.require('DAO')
var MetaOrgan = artifacts.require('MetaOrgan')
var TokensOrgan = artifacts.require('TokensOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')

const organs = [VaultOrgan, TokensOrgan, ActionsOrgan, ApplicationOrgan]

const { getNonce } = require('../test/helpers/web3')

module.exports = (deployer) => {
  let dao = {}

  return deployer.deploy(DAO, { gas: 4e6 })
    .then(() => {
      dao = MetaOrgan.at(DAO.address)

      const firstOrgan = 3
      let nonce = 0

      const installOrgan = (organ, i) => {
        const n = i + firstOrgan
        console.log('Installing', organ.constructor._json.contract_name, organ.address, 'at slot', n)
        nonce += 1

        return dao.installOrgan(organ.address, n, { nonce })
      }

      return getNonce(web3).then(x => {
        nonce = x - 1
        const installOrgans = Promise.all(organs.map((organ, i) => {
          nonce += 1
          return organ.new({ nonce })
        }))
          .then(x => Promise.all(x.map(installOrgan)))
        return installOrgans
      })
    })
}
