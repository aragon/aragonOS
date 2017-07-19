var DAO = artifacts.require('DAO')
var Kernel = artifacts.require('Kernel')
var MetaOrgan = artifacts.require('MetaOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')
var IOrgan = artifacts.require('IOrgan')

const organs = [MetaOrgan, VaultOrgan, ActionsOrgan]

const { getNonce, signatures } = require('../test/helpers/web3')

const liveNetworks = ['kovan', 'ropsten']

module.exports = (deployer, network) => {
  let dao, meta = {}

  const isLive = liveNetworks.indexOf(network) > -1

  return deployer
          .then(() => deployer.deploy(MetaOrgan))
          .then(m => {
            meta = MetaOrgan.at(MetaOrgan.address)

            return deployer.deploy(Kernel, meta.address)
          })
          .then(k => {
            console.log('deploying DAO with Kernel', Kernel.address)
            return deployer.deploy(DAO, Kernel.address, { gas: 4e6 })
              .then(() => {
                dao = MetaOrgan.at(DAO.address)

                const firstOrgan = 3
                let nonce = 0

                const installOrgan = (organ, i) => {
                  const sigs = signatures(organ, [IOrgan], web3)
                  console.log('Installing', organ.constructor._json.contract_name, organ.address, 'for sigs', sigs.join(','))

                  nonce += 1

                  const params = isLive ? { nonce } : {}
                  return dao.installOrgan(organ.address, sigs, params)
                }

                return getNonce(web3).then(x => {
                  nonce = x - 1
                  const installOrgans = Promise.all(organs.map((organ, i) => {
                    nonce += 1

                    const params = isLive ? { nonce } : {}
                    return organ.new(params)
                  }))
                    .then(x => Promise.all(x.map(installOrgan)))
                  return installOrgans
                })
              })
          })
}
