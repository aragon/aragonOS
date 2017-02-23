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

const from = web3.eth.accounts[8] || '0xfcea9c5d4967956d4b209f6b1e9d2162ce96149b'
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
    .then(f => f.deployCompany({ value: 1e18, gas: 5e6, from }))
    .then(r => {
      companyAddress = r.logs.filter(e => e.event === 'NewCompany')[0].args.companyAddress
      console.log('Company address: ', companyAddress)
      Company.at(companyAddress).Debug({}).watch(console.log)
      return conf.configureCompany(companyAddress, 1000, [from, "0xb50bfD52E313751029D7E2C09D3441A4bBCec750", "0xb125b0c784f538e9a67c849624d9344072580f0e"], ["0xb50bfD52E313751029D7E2C09D3441A4bBCec750", from], [600, 250], { from })
    })
    .then(() => Company.at(companyAddress).sigPayload(nonce))
    .then(payload => {
      const signature = web3.eth.sign(from, payload)

      const r = signature.slice(0, 66)
      const s = `0x${signature.slice(66, 130)}`
      const v = `0x${parseInt(signature.slice(130, 132), 0) > 0 ? '1c' : '1b'}`
      return GenericBinaryVoting.new('0x0', companyAddress, r, s, v, nonce, { from })
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
