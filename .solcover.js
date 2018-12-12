const skipFiles = [
  'lib',
  'test',
  'acl/ACLSyntaxSugar.sol',
  'common/DepositableStorage.sol', // Used in tests that send ETH
  'common/UnstructuredStorage.sol' // Used in tests that send ETH
]

module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles,
}
