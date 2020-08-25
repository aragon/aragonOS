module.exports = {
  skipFiles: [
    'lib',
    'test',
    'acl/ACLSyntaxSugar.sol',
  ],
  mocha: {
    grep: '@skip-on-coverage', // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  }
}
