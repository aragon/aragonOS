const GasPriceOracle = require('./GasPriceOracle')

const DEFAULT_DOMAIN_NAME = 'Aragon Relayer'
const DEFAULT_DOMAIN_VERSION = '1'

const GAS_MULTIPLIER = 1.18

const FIRST_TX_GAS_OVERLOAD = 83500
const NORMAL_TX_GAS_OVERLOAD = 53500

const DATA_TYPES = {
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
}

module.exports = web3 => class RelayTransactionSigner {
  constructor(relayer, domainName = DEFAULT_DOMAIN_NAME, domainVersion = DEFAULT_DOMAIN_VERSION) {
    this.relayer = relayer
    this.domainName = domainName
    this.domainVersion = domainVersion
  }

  async signTransaction({ from, to, data, nonce = undefined, gasRefund = undefined, gasPrice = undefined }, service = undefined) {
    if (!nonce) nonce = await this._fetchNextNonce(from)
    if (!gasPrice) gasPrice = await this._estimateGasPrice()
    if (!gasRefund) gasRefund = service
      ? await this._estimateRelayGasWithService(service, { from, to, data, nonce, gasPrice })
      : await this._estimateRelayGasConservatively({ from, to, data, nonce, gasPrice })

    const message = { from, to, nonce, data, gasRefund, gasPrice }
    const signature = await this.signMessage(message)
    return { ...message, signature }
  }

  async signMessage({ from, to, nonce, data, gasRefund, gasPrice }) {
    const message = { to, nonce, data, gasRefund, gasPrice }
    const params = { method: 'eth_signTypedData', params: [from, this._typeData(message)], from }
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync(params, (error, tx) => {
        return error ? reject(error) : resolve(tx.result)
      })
    })
  }

  async _fetchNextNonce(sender) {
    const lastUsedNonce = (await this.relayer.getSender(sender))[1]
    return parseInt(lastUsedNonce.toString()) + 1
  }

  async _estimateRelayGasWithService(service, { from, to, data, nonce, gasPrice }) {
    // simulate signature using gas limit as worst case scenario
    const gasLimit = await this._gasLimit()
    const signature = await this.signMessage({ from, to, nonce, data, gasRefund: gasLimit, gasPrice })
    const estimatedGas = await service.estimateGas({ from, to, nonce, data, gasRefund: gasLimit, gasPrice, signature })
    return Math.ceil(estimatedGas * GAS_MULTIPLIER)
  }

  async _estimateRelayGasConservatively({ from, to, data, nonce }) {
    const estimatedGas = await this._estimateCallGas({ from, to, data })
    const relayOverload = nonce === 1 ? FIRST_TX_GAS_OVERLOAD : NORMAL_TX_GAS_OVERLOAD
    return Math.ceil((estimatedGas + relayOverload) * GAS_MULTIPLIER)
  }

  async _estimateCallGas({ from, to, data }) {
    const call = { from, to, data }
    return new Promise((resolve, reject) => {
      web3.eth.estimateGas(call, (error, response) => {
        return error ? reject(error) : resolve(response)
      })
    })
  }

  async _estimateGasPrice() {
    return GasPriceOracle.fetch(this._networkId())
  }

  async _gasLimit() {
    const block = await this._latestBlock()
    return block.gasLimit
  }

  async _latestBlock() {
    return new Promise((resolve, reject) => {
      web3.eth.getBlock('latest', (error, response) => {
        return error ? reject(error) : resolve(response)
      })
    })
  }

  _networkId() {
    return parseInt(this.relayer.constructor.network_id)
  }

  _typeData(message) {
    return {
      types: DATA_TYPES,
      primaryType: 'Transaction',
      domain: {
        name: this.domainName,
        version: this.domainVersion,
        chainId: this._networkId(),
        verifyingContract: this.relayer.address
      },
      message: message
    }
  }
}
