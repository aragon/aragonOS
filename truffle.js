require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'stumble story behind hurt patient ball whisper art swift tongue ice alien';

module.exports = {
  networks: {
    development: {
      network_id: 15,
      provider: require('ethereumjs-testrpc').provider({ gasLimit: 1e8 }),
      gas: 9e6,
    },
    ropsten: {
      network_id: 3,
      // provider: new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/'),
      gas: 4.712e6,
    },
    kovan: {
      network_id: 42,
      // provider:  new HDWalletProvider(mnemonic, 'https://kovan.aragon.one'),
      gas: 4.99e6,
    },
    development46: {
      network_id: 15,
      host: 'localhost',
      port: 8546,
      gas: 1e8,
    },
  },
  build: {},
}
