const Migrations = artifacts.require('Migrations.sol')

const BylawsLib = artifacts.require('BylawsLib')
const BylawsApp = artifacts.require('BylawsApp')

module.exports = (deployer) => {
  deployer.deploy(BylawsLib, { gas: 4e6 })
  deployer.link(BylawsLib, BylawsApp)
}
