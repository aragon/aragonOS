// This migrations file is **NEEDED** for testing, due to the way we're pulling solidity tests into
// the JS environment.
// It sets up the test files and links them with the Assert library

const Assert = artifacts.require('Assert.sol');
const TestACLInterpreter = artifacts.require('TestACLInterpreter.sol');
const TestDelegateProxy = artifacts.require('TestDelegateProxy.sol');

module.exports = function (deployer) {
    console.log('Deploying tests...')
    deployer.deploy(Assert).then(() => {
        deployer.deploy(TestACLInterpreter);
        deployer.deploy(TestDelegateProxy);
    });
    deployer.link(Assert, TestACLInterpreter);
    deployer.link(Assert, TestDelegateProxy);
};
