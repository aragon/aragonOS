module.exports = (deployer) => (
  deployer
    .then(() => Company.deployed().grantStock(0, 100, web3.eth.accounts[0]))
)
