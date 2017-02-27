module.exports = {
  networks: {
    development: {
      network_id: 15,
      host: 'localhost',
      port: 8545,
    },
    ropsten: {
      network_id: 3,
      host: 'localhost',
      port: 8545,
      from: '0xfcea9c5d4967956d4b209f6b1e9d2162ce96149b',
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
    },
  },
  build: {},
}
