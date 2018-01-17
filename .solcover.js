// NOTE: Upgrading to solidity-coverage 0.4.x breaks our tests

const files = require('glob').sync('contracts/lib/**/*.sol').map(n => n.replace('contracts/', ''))

module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: ['common/IForwarder.sol', 'kernel/IKernel.sol', 'apps/IAppProxy.sol'].concat(files),
    copyNodeModules: true,
}
