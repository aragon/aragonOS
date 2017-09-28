require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'stumble story behind hurt patient ball whisper art swift tongue ice alien';

let developmentProvider, ropstenProvider, kovanProvider = {}

if (!process.env.SOLIDITY_COVERAGE){
  developmentProvider = require('ethereumjs-testrpc').provider({ gasLimit: 1e8, network_id: 15 })
}

if (process.env.LIVE_NETWORKS) {
  ropstenProvider = new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/')
  kovanProvider = new HDWalletProvider(mnemonic, 'https://kovan.infura.io')
}

module.exports = {
  networks: {
    development: {
      network_id: 15,
      provider: developmentProvider,
      gas: 9e6,
    },
    rpc: {
      network_id: 15,
      host: 'localhost',
      port: 8545,
      gas: 7e6,
    },
    ropsten: {
      network_id: 3,
      provider: ropstenProvider,
      gas: 4.712e6,
    },
    kovan: {
      network_id: 42,
      provider: kovanProvider,
      gas: 6.9e6,
    },
    /*
    kovan2: {
      network_id: 42,
      host: 'localhost',
      port: 8545,
      gas: 4e6,
      from: '0x0031edb4846bab2ededd7f724e58c50762a45cb2',
    },ha
    */
    development46: {
      network_id: 15,
      host: 'localhost',
      port: 8546,
      gas: 1e8,
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,
      gas: 0xffffffffff,
      gasPrice: 0x01
    },
  },
  build: {},
}
