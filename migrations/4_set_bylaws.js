module.exports = (deployer) => (
  deployer
    .then(() => Company.deployed().setInitialBylaws())
)
