const sendTransaction = payload => {
  return new Promise((resolve, reject) => {
    web3.eth.sendTransaction(payload, async (err, res) => {
      if (err || !res) return reject(err)
      resolve(res)
    })
  })
}

module.exports = { sendTransaction }
