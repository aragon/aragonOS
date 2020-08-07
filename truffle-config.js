const TruffleConfig = require('@aragon/truffle-config-v5/truffle-config')

TruffleConfig.compilers.solc.version = '0.4.24'
TruffleConfig.plugins = ["solidity-coverage"]

module.exports = TruffleConfig
