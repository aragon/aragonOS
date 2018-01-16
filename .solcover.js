module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    // Interfaces make solidity-coverage crash https://github.com/sc-forks/solidity-coverage/issues/162
    skipFiles: ['lib', 'node_modules', 'common/IForwarder.sol', 'kernel/IKernel.sol'],
    copyNodeModules: true,
}
