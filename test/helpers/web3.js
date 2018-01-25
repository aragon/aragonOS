// TODO: pls abstract promisification over web3

module.exports = {
  signatures(contract, exclude, web3, names = false, excludeConstant = false) {
    const flatten = x => [].concat.apply([], x)
    const sig = f => `${f.name}(${f.inputs.map(x=>x.type).join(',')})`

    const excludedSigs = flatten(exclude.map(x => x.abi)).map(sig)

    let signatures = contract.abi
      .filter(x => x.type == 'function')
      .filter(s => !excludeConstant || !s.constant)
      .map(sig)
      .filter(s => excludedSigs.indexOf(s) < 0)

     let bs = signatures.map(s => web3.sha3(s).slice(0, 10)).sort()
     if (names)
        return bs.map((b, i) => ({ name: signatures[i], bytes: b }))

     return bs
  },

  getBalance(addr) {
    return new Promise((resolve, reject) => {
      web3.eth.getBalance(addr, async (err, res) => {
        if (err || !res) return reject(err)
        resolve(res)
      })
    })
  },

  getBlockNumber() {
    return new Promise((resolve, reject) => {
      web3.eth.getBlockNumber(async (err, res) => {
        if (err || !res) return reject(err)
        resolve(res)
      })
    })
  },

  getBlock(n) {
    return new Promise(async (resolve, reject) => {
      web3.eth.getBlock(n, (err, res) => {
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

  getNonce(web3) {
    return new Promise((resolve, reject) => {
      web3.eth.getAccounts((err, acc) => {
        if (err) return reject(err)
        web3.eth.getTransactionCount(acc[0], (err, n) => {
          if (err) return reject(err)
          resolve(n)
        })
      })
    })
  },

  sign(payload, address) {
    return new Promise((resolve, reject) => {
      web3.eth.sign(address, payload, async (err, signedPayload) => {
        if (err || !signedPayload) return reject(err)
        const adding0x = x => '0x'.concat(x)
        resolve({
          r: adding0x(signedPayload.substr(2, 64)),
          s: adding0x(signedPayload.substr(66, 64)),
          v: signedPayload.substr(130, 2) == '00' ? 27 : 28,
        })
      })
    })
  }
}
