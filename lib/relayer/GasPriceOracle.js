const GAS_STATION_API_URL = 'https://ethgasstation.info/json/ethgasAPI.json'

const DEFAULT_DEVNET_GAS_PRICE = 1e5
const DEFAULT_TESTNET_GAS_PRICE = 1e6

const MAINNET_ID = 1
const TESTNET_IDS = [2, 3, 42] // ropsten, rinkeby and kovan

module.exports = {
  async fetch(networkId) {
    if (MAINNET_ID === networkId) return this._fetchMainnetGasPrice()
    if (TESTNET_IDS.includes(networkId)) return DEFAULT_TESTNET_GAS_PRICE
    return DEFAULT_DEVNET_GAS_PRICE
  },

  async _fetchMainnetGasPrice() {
    try {
      const axios = require('axios')
      const { data: responseData } = await axios.get(GAS_STATION_API_URL)
      return (responseData.average / 10) * 1e9
    } catch (error) {
      throw new Error(`Could not fetch gas price from ETH gas station: ${error}`)
    }
  }
}
