module.exports = web3 => (
  new Promise((resolve, reject) => {
    web3.eth.getAccounts((err, accounts) => {
      if (err) {
        return reject(err)
      }
      resolve(accounts)
    })
  })
)