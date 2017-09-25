var glob = require('glob')
var path = require('path')
var basePath = './artifacts'

module.exports = glob.sync(
  path.resolve(__dirname, basePath, '*.json')
).reduce(function (contracts, file) {
  var contract = require(file)

  if (contract.contract_name) {
    contracts[contract.contract_name] = contract
  }

  return contracts
}, {})
