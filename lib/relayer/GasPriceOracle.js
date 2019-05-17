const GAS_STATION_API_URL = 'https://ethgasstation.info/json/ethgasAPI.json'

const DEFAULT_GAS_PRICE_VALUE = 1e6

module.exports = {
  async fetch(networkId) {
    if (networkId === 1) return this._fetchMainnetGasPrice()
    else return DEFAULT_GAS_PRICE_VALUE
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
