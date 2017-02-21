const AccountingLib = artifacts.require('AccountingLib.sol')
const BylawsLib = artifacts.require('BylawsLib.sol')
const Company = artifacts.require('Company.sol')
const CompanyFactory = artifacts.require('CompanyFactory.sol')
const CompanyConfiguratorFactory = artifacts.require('CompanyConfiguratorFactory.sol')
const VotingStock = artifacts.require('VotingStock.sol')
const NonVotingStock = artifacts.require('NonVotingStock.sol')
const GenericBinaryVoting = artifacts.require('GenericBinaryVoting.sol')
const BytesHelper = artifacts.require('BytesHelper.sol')

const from = web3.eth.accounts[8] || 'fcea9c5d4967956d4b209f6b1e9d2162ce96149b'

module.exports = (deployer) => {
  let company = null

  deployer.deploy(AccountingLib)
  deployer.link(AccountingLib, [Company, CompanyFactory])
  deployer.deploy(BylawsLib)
  deployer.link(BylawsLib, [Company, CompanyFactory])
  deployer.deploy(BytesHelper)
  deployer.link(BytesHelper, GenericBinaryVoting)

  deployer.deploy(CompanyConfiguratorFactory)
    .then(() => CompanyConfiguratorFactory.deployed())
    .then(c => conf = c)
    .then(() => deployer.deploy(CompanyFactory, conf.address))
    .then(() => CompanyFactory.deployed())
    .then(f => f.deployCompany({ value: 1e17, from }))
    .then(r => {
      const companyAddress = r.logs.filter(e => e.event === 'NewCompany')[0].args.companyAddress
      console.log('Company address: ', companyAddress)
      return conf.configureCompany(companyAddress, 1000, [from, "0xb50bfD52E313751029D7E2C09D3441A4bBCec750", "0xb125b0c784f538e9a67c849624d9344072580f0e"], ["0xb50bfD52E313751029D7E2C09D3441A4bBCec750", "0x2"], [600, 250], { from })
    })
  /*
  deployer.deploy(Company, { gas: 10e6, value: 1e18 })
    .then(() => Company.deployed())
    .then(c => {
      company = c
      return deployer.deploy(VotingStock, company.address)
    })
    .then(() => deployer.deploy(NonVotingStock, company.address))
    .then(() => VotingStock.deployed().then(vs => company.addStock(vs.address, 1e3)))
    .then(() => NonVotingStock.deployed().then(nvs => company.addStock(nvs.address, 1e4)))
   */
}
