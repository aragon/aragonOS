var HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'stumble story behind hurt patient ball whisper art swift tongue ice alien';
const ropstenProvider = new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/');
const kovanProvider = new HDWalletProvider(mnemonic, 'https://kovan.aragon.one');

module.exports = {
  networks: {
    development: {
      network_id: 15,
      provider: require('ethereumjs-testrpc').provider({ gasLimit: 100000000 }),
    },
    ropsten: {
      network_id: 3,
      provider: ropstenProvider,
      gas: 4.712e6,
    },
    kovan: {
      network_id: 42,
      provider: kovanProvider,
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
