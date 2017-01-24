module.exports = (deployer) => {
  deployer.deploy(AccountingLib)
  deployer.link(AccountingLib, Company)
  deployer.deploy(BylawsLib)
  deployer.link(BylawsLib, Company)
  deployer.deploy(Company, { value: web3.toWei(1, 'ether') })
    .then(() => deployer.deploy(VotingStock, Company.deployed().address))
    .then(() => deployer.deploy(NonVotingStock, Company.deployed().address))
    .then(() => Company.deployed().addStock(VotingStock.deployed().address, 1000))
    .then(() => Company.deployed().addStock(NonVotingStock.deployed().address, 10000))
}
