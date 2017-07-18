require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'stumble story behind hurt patient ball whisper art swift tongue ice alien';

module.exports = {
  networks: {
    development: {
      network_id: 15,
      provider: require('ethereumjs-testrpc').provider({ gasLimit: 1e8, network_id: 15 }),
      gas: 9e6,
    },
    testrpc: {
      network_id: 15,
      host: 'localhost',
      port: 8545,
      gas: 1e8,
    },
    ropsten: {
      network_id: 3,
      // provider: new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/'),
      gas: 4.712e6,
    },
    kovan: {
      network_id: 42,
      provider:  new HDWalletProvider(mnemonic, 'https://kovan.aragon.one'),
      gas: 4.6e6,
    },
    /*
    kovan2: {
      network_id: 42,
      host: 'localhost',
      port: 8545,
      gas: 4e6,
      from: '0x0031edb4846bab2ededd7f724e58c50762a45cb2',
    },
    */
    development46: {
      network_id: 15,
      host: 'localhost',
      port: 8546,
      gas: 1e8,
    },
  },
  build: {},
}
