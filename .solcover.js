const skipFiles = [
  'lib',
  'test',
  'acl/ACLSyntaxSugar.sol',
  'common/DepositableStorage.sol',  // Used in tests that send ETH
  'common/SafeERC20.sol',           // solidity-coverage fails on assembly if (https://github.com/sc-forks/solidity-coverage/issues/287)
  'common/UnstructuredStorage.sol', // Used in tests that send ETH
  'relayer/Relayer.sol',            // solidity-coverage uses test-rpc which does not implement eth_signTypedData
  'relayer/RelayedAragonApp.sol'    // solidity-coverage uses test-rpc which does not implement eth_signTypedData
]

module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles,
}
