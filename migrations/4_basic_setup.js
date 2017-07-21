var DAO = artifacts.require('DAO')
var OwnershipApp = artifacts.require('OwnershipApp')
var BylawsApp = artifacts.require('BylawsApp')
var MiniMeToken = artifacts.require('MiniMeToken')

module.exports = (deployer) => {
  let dao, token = {}

  return deployer
    .then(() => DAO.deployed())
    .then(d => {
      dao = d
      return MiniMeToken.new('0x0', '0x0', 0, 'TT', 18, '', true)
    })
    .then(t => {
      token = t
      return token.changeController(dao.address)
    })
    .then(() => {
      console.log('Adding DAO gov token', token.address)
      return OwnershipApp.at(dao.address).addToken(token.address, 0, 1, 1)
    })
}
