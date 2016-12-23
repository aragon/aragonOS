module.exports = (deployer) => (
  deployer.deploy(Company)
    .then(() => deployer.deploy(VotingStock, Company.deployed().address))
    .then(() => deployer.deploy(NonVotingStock, Company.deployed().address))
    .then(() => Company.deployed().addStock(VotingStock.deployed().address, 1000))
    // .then(() => Company.deployed().grantStock(0, deo))
)
