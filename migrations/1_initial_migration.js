const Migrations = artifacts.require('Migrations.sol')

module.exports = (deployer) => {
  console.log('running migrations')
  deployer.deploy(Migrations)
}
