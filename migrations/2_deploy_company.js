module.exports = (deployer) => {
  return deployer.deploy(Company)
    .then(() => deployer.deploy(VotingStock, Company.deployed().address))
    .then(() => Company.deployed().addStock(VotingStock.deployed().address))
}
