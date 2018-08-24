const libFiles = require('glob').sync('contracts/lib/**/*.sol').map(n => n.replace('contracts/', ''))

const skipFiles = libFiles.concat(['mocks', 'acl/ACLSyntaxSugar.sol'])

module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles,
}
