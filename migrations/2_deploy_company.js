module.exports = (deployer) => {
  deployer.deploy(AccountingLib)
  deployer.link(AccountingLib, Company)
  deployer.deploy(BylawsLib)
  deployer.link(BylawsLib, Company)
  deployer.deploy(Company, { gas: 5e6, value: 1e18 })
    .then(() => deployer.deploy(VotingStock, Company.deployed().address))
    .then(() => deployer.deploy(NonVotingStock, Company.deployed().address))
    .then(() => Company.deployed().addStock(VotingStock.deployed().address, 1e3))
    .then(() => Company.deployed().addStock(NonVotingStock.deployed().address, 1e4))
}
