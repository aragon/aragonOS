const DAO = artifacts.require('DAO')
const MetaOrgan = artifacts.require('MetaOrgan')
const Kernel = artifacts.require('Kernel')

let dao = {}

module.exports = (deployer) => {
  deployer
    .then(() => DAO.new())
    .then(d => {
      dao = d
      console.log('dao', dao.address)
    })
    .then(() => dao.getSelf())
    .then(k => {
      console.log('self', k)
    })
    .then(() => dao.getKernel())
    .then(k => {
      console.log('kernel', k)
    })
    .then(() => {
      return MetaOrgan.at(dao.address).replaceKernel('0x1234')
    })
    .then(() => dao.getKernel())
    .then(k => {
      console.log('new kernel', k)
    })
}
