var HDWalletProvider = require('truffle-hdwallet-provider');

var mnemonic = 'stumble story behind hurt patient ball whisper art swift tongue ice alien';
var ropstenProvider = new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/');

module.exports = {
  networks: {
    development: {
      network_id: 15,
      host: 'localhost',
      port: 8545,
      gas: 100000000,
    },
    ropsten: {
      network_id: 3,
      provider: ropstenProvider,
    },
    kovan: {
      network_id: 42,
      host: 'localhost',
      gas: 4900000,
      port: 8545,
      from: '0x0031EDb4846BAb2EDEdd7f724E58C50762a45Cb2',
    },
    landing: {
      network_id: 1234,
      host: 'eth-rpc.aragon.one',
      port: 80,
    },
    development46: {
      network_id: 15,
      host: 'localhost',
      port: 8546,
      gas: 100000000,
    },
  },
  build: {},
}
