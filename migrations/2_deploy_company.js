const DAO = artifacts.require('DAO')
const MetaOrgan = artifacts.require('MetaOrgan')

let dao = {}

module.exports = (deployer) => {
  deployer
    .then(() => DAO.new())
    .then(d => {
      dao = d
      console.log('dao', dao.address)
      return MetaOrgan.at(dao.address).replaceKernel('0x1234')
    })
    .then(() => dao.kernel())
    .then(k => {
      console.log('kernel', k)
    })
}
