module.exports = {
  networks: {
    ropsten: {
      network_id: 3,
      port: 8546,
      from: '0xfcea9c5d4967956d4b209f6b1e9d2162ce96149b',
    },
    landing: {
      network_id: 1234,
      host: 'eth-rpc.provident.ai',
      port: 80,
    },
  },
  build: {},
}
