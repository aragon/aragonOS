const DAO = artifacts.require('DAO')
const MetaOrgan = artifacts.require('MetaOrgan')
const Kernel = artifacts.require('Kernel')

let dao = {}

module.exports = (deployer) => {
  deployer
    .then(() => DAO.new())
}
