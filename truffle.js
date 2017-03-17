module.exports = {
  networks: {
    development: {
      network_id: 15,
      host: 'localhost',
      port: 8545,
      gas: 10000000,
    },
    development46: {
      network_id: 15,
      host: 'localhost',
      port: 8546,
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
    kovan: {
      network_id: 42,
      host: 'localhost',
      gas: 4900000,
      port: 8545,
      from: '0x0031EDb4846BAb2EDEdd7f724E58C50762a45Cb2',
    },
  },
  build: {},
}
