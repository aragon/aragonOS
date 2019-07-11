const TYPED_DATA = (relayer, message) => ({
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Transaction: [
      { name: 'to', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'gasRefund', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' }
    ],
  },
  primaryType: "Transaction",
  domain: {
    name: 'Aragon Relayer',
    version: '1',
    chainId: 1,
    verifyingContract: relayer.address
  },
  message: message
})


module.exports = (web3) => async (relayer, sender, message) => {
  const params = { method: 'eth_signTypedData', params: [sender, TYPED_DATA(relayer, message)], from: sender }
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync(params, (error, tx) => {
      return error ? reject(error) : resolve(tx.result)
    })
  })
}
