const AccountingLib = artifacts.require('AccountingLib.sol')
const BylawsLib = artifacts.require('BylawsLib.sol')
const VotingLib = artifacts.require('VotingLib.sol')
const Company = artifacts.require('Company.sol')
const CompanyFactory = artifacts.require('CompanyFactory.sol')
const CompanyConfiguratorFactory = artifacts.require('CompanyConfiguratorFactory.sol')
const VotingStock = artifacts.require('VotingStock.sol')
const NonVotingStock = artifacts.require('NonVotingStock.sol')
const GenericBinaryVoting = artifacts.require('GenericBinaryVoting.sol')
const BytesHelper = artifacts.require('BytesHelper.sol')
const VerifyLib = artifacts.require('VerifyLib.sol')

// const utils = require('ethereumjs-util')

const networks = {
  15: web3.eth.accounts[0],
  3: '0xfcea9c5d4967956d4b209f6b1e9d2162ce96149b',
  42: '0x0031EDb4846BAb2EDEdd7f724E58C50762a45Cb2',
}

const from = networks[web3.version.network]

const nonce = parseInt(Math.random() * 1e15)
const gas = web3.version.network == 15 ? 10e7 : 5e6

module.exports = (deployer) => {
  let company = null

  deployer.deploy(AccountingLib, { gas })
  deployer.link(AccountingLib, [Company, CompanyFactory])
  deployer.deploy(BylawsLib, { gas })
  deployer.link(BylawsLib, [Company, CompanyFactory])
  deployer.deploy(VotingLib)
  deployer.link(VotingLib, [Company, CompanyFactory])

  deployer.deploy(BytesHelper, { gas })
  deployer.link(BytesHelper, GenericBinaryVoting)

  deployer.deploy(CompanyConfiguratorFactory, { from, gas })
    .then(() => CompanyConfiguratorFactory.deployed())
    .then(c => conf = c)
    .then(() => deployer.deploy(CompanyFactory, conf.address, { from, gas }))
    .then(() => CompanyFactory.deployed())
    .then(f => {
      factory = f
      return conf.setFactory(factory.address, { from, gas })
    })
    /*
    .then(() => factory.deployCompany({ from, gas }))
    .then(r => {
      companyAddress = r.logs.filter(e => e.event === 'NewCompany')[0].args.companyAddress
      console.log('Company address: ', companyAddress)
      return conf.configureCompany(companyAddress, from, { from, gas })
    })
    */
}
