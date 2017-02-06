const AccountingLib = artifacts.require('AccountingLib.sol')
const BylawsLib = artifacts.require('BylawsLib.sol')
const Company = artifacts.require('Company.sol')
const VotingStock = artifacts.require('VotingStock.sol')
const NonVotingStock = artifacts.require('NonVotingStock.sol')

module.exports = (deployer) => {
  let company = null

  deployer.deploy(AccountingLib)
  deployer.link(AccountingLib, Company)
  deployer.deploy(BylawsLib)
  deployer.link(BylawsLib, Company)
  deployer.deploy(Company, { gas: 5e6, value: 1e18 })
    .then(() => Company.deployed())
    .then(c => {
      company = c
      return deployer.deploy(VotingStock, company.address)
    })
    .then(() => deployer.deploy(NonVotingStock, company.address))
    .then(() => VotingStock.deployed().then(vs => company.addStock(vs.address, 1e3)))
    .then(() => NonVotingStock.deployed().then(nvs => company.addStock(nvs.address, 1e4)))
}
