// TODO: pls abstract promisification over web3

module.exports = {
  getBalance(addr) {
    return new Promise((resolve, reject) => {
      web3.eth.getBalance(addr, async (err, res) => {
        if (err || !res) return reject(err)
        resolve(res)
      })
    })
  },

  sendTransaction(payload) {
    return new Promise((resolve, reject) => {
      web3.eth.sendTransaction(payload, async (err, res) => {
        if (err || !res) return reject(err)
        resolve(res)
      })
    })
  },

  sign(payload, address) {
    return new Promise((resolve, reject) => {
      web3.eth.sign(address, payload, async (err, res) => {
        if (err || !res) return reject(err)
        resolve(res)
      })
    })
  }
}
