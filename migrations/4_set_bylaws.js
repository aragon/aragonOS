const Company = artifacts.require('Company.sol')

module.exports = (deployer) => (
  deployer
    .then(() => Company.deployed().then(c => c.setInitialBylaws()))
)
