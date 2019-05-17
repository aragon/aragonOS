const GasPriceOracle = require('./GasPriceOracle')

module.exports = (artifacts, web3) => class RelayerService {
  constructor(wallet, relayer) {
    this.wallet = wallet
    this.relayer = relayer
  }

  async relay(transaction) {
    await this._assertTargetIsAragonApp(transaction)
    await this._assertTransactionWontRevert(transaction)
    await this._assertTransactionGasCostIsCovered(transaction)
    await this._assertTransactionReasonableGasPrice(transaction)

    return this._relay(transaction)
  }

  async estimateGas(transaction) {
    return this._estimateGas(transaction)
  }

  async _relay(transaction) {
    const { from, to, nonce, data, gasRefund, gasPrice, signature } = transaction
    const txParams = { from: this.wallet, gas: gasRefund, gasPrice }

    // console.log(`\nRelaying transaction ${JSON.stringify(transaction)} with params ${JSON.stringify(txParams)}`)
    return this.relayer.relay(from, to, nonce, data, gasRefund, gasPrice, signature, txParams)
  }

  async _assertTargetIsAragonApp({ to }) {
    let relayerKernel, aragonAppKernel
    try {
      relayerKernel = await this.relayer.kernel()
      aragonAppKernel = await artifacts.require('AragonApp').at(to).kernel()
    } catch (error) {
      throw Error(`Could not ensure target address is actually an AragonApp from the same Kernel: ${error}`)
    }
    if (relayerKernel === aragonAppKernel) return;
    throw Error(`The Kernel of the target app ${aragonAppKernel} does not match with the Kernel of the current realyer ${relayerKernel}`)
  }

  async _assertTransactionWontRevert(transaction) {
    const error = await this._transactionWillFail(transaction)
    if (!error) return

    throw Error(error.message.search(/(revert|invalid opcode|invalid jump)/) > -1
      ? `Will not relay failing transaction: ${error.message}`
      : `Could not estimate gas: ${error.message}`)
  }

  async _assertTransactionGasCostIsCovered(transaction) {
    const { gasRefund } = transaction
    const estimatedGas = await this._estimateGas(transaction)
    if (gasRefund < estimatedGas) throw Error(`Given gas refund amount ${gasRefund} does not cover transaction gas cost ${estimatedGas}`)
  }

  async _assertTransactionReasonableGasPrice(transaction) {
    const averageGasPrice = await GasPriceOracle.fetch(this._networkId())
    if (transaction.gasPrice < averageGasPrice) throw Error(`Given gas price is below the average ${averageGasPrice}`)
  }

  async _transactionWillFail(transaction) {
    try {
      await this._estimateGas(transaction)
      return false
    } catch (error) {
      return error
    }
  }

  async _estimateGas({ from, to, nonce, data, gasRefund, gasPrice, signature }) {
    const calldata = this.relayer.contract.relay.getData(from, to, nonce, data, gasRefund, gasPrice, signature)
    const call = { from: this.wallet, to: this.relayer.address, data: calldata }

    return new Promise((resolve, reject) => {
      web3.eth.estimateGas(call, (error, response) => {
        return error ? reject(error) : resolve(response)
      })
    })
  }

  _networkId() {
    return this.relayer.constructor.network_id
  }
}
