// NOTE: Upgrading to solidity-coverage 0.4.x breaks our tests

const libFiles = require('glob').sync('contracts/lib/**/*.sol').map(n => n.replace('contracts/', ''))
const interfaces = [
  'acl/IACL.sol',
  'acl/IACLOracle.sol',
  'acl/ACLSyntaxSugar.sol',
  'common/IForwarder.sol',
  'common/IVaultRecoverable.sol',
  'evmscript/IEVMScriptExecutor.sol',
  'kernel/IKernel.sol',
  'mocks',
]

module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: interfaces.concat(libFiles),
    copyNodeModules: true,
}
