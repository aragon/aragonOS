const Company = artifacts.require('Company.sol')

const devAccounts = [
  "0xb50bfD52E313751029D7E2C09D3441A4bBCec750",
  "0x88789B2f9512C61662028faCCc08506ADE683C4E",
]

module.exports = (deployer) => {
  let company = null
  return deployer
    .then(() => Company.deployed())
    .then(c => {
      company = c
      return company.grantStock(0, 500, web3.eth.accounts[0])
    })
    .then(() => Promise.all(devAccounts.map(a => company.grantStock(0, 100, a))))
    // .then(() => Promise.all(devAccounts.map(a => web3.eth.sendTransaction({ from: web3.eth.accounts[0], to: a, value: web3.toWei(2, 'ether') }))))
    .then(() => Promise.all(devAccounts.map(a => company.setEntityStatusByStatus(a, 2))))
}
