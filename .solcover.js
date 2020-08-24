module.exports = {
  skipFiles: [
    'lib',
    'test',
    'acl/ACLSyntaxSugar.sol',
    'common/DepositableStorage.sol', // Used in tests that send ETH
    'common/UnstructuredStorage.sol' // Used in tests that send ETH
  ],
  mocha: {
    grep: '@skip-on-coverage', // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  }
}
