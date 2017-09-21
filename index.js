var glob = require('glob')
var path = require('path')

var artifactsBasePath = './artifacts'
var contractsBasePath = './build/contracts'

module.exports.artifacts = glob.sync(
  path.resolve(__dirname, artifactsBasePath, '*.json')
).reduce(function (artifacts, file) {
  var artifact = require(file)

  if (artifact.id) {
    artifacts[artifact.id] = artifact
  }

  return artifacts
}, {})

module.exports.contracts = glob.sync(
  path.resolve(__dirname, contractsBasePath, '*.json')
).reduce(function (contracts, file) {
  var contract = require(file)

  if (contract.contract_name) {
    contracts[contract.contract_name] = contract
  }

  return contracts
}, {})
