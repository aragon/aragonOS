const AccountingLib = artifacts.require('AccountingLib.sol')
const BylawsLib = artifacts.require('BylawsLib.sol')
const Company = artifacts.require('Company.sol')
const CompanyFactory = artifacts.require('CompanyFactory.sol')
const CompanyConfiguratorFactory = artifacts.require('CompanyConfiguratorFactory.sol')
const VotingStock = artifacts.require('VotingStock.sol')
const NonVotingStock = artifacts.require('NonVotingStock.sol')
const GenericBinaryVoting = artifacts.require('GenericBinaryVoting.sol')
const BytesHelper = artifacts.require('BytesHelper.sol')
const VerifyLib = artifacts.require('VerifyLib.sol')

// const utils = require('ethereumjs-util')

const from = web3.eth.accounts[0] || '0xfcea9c5d4967956d4b209f6b1e9d2162ce96149b'
const nonce = parseInt(Math.random() * 1e15)

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
    .then(() => deployer.deploy(CompanyFactory, conf.address, {gas: 5e6}))
    .then(() => CompanyFactory.deployed())
    .then(f => f.deployCompany({ gas: 5e6, from }))
    .then(r => {
      console.log(r)
      companyAddress = r.logs.filter(e => e.event === 'NewCompany')[0].args.companyAddress
      console.log('Company address: ', companyAddress)
      return conf.configureCompany(companyAddress, from, { from })
    })
}
