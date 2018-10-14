const flatten = require('truffle-flattener')
const mkdirp = require('mkdirp')
const fs = require('fs')
const path = require('path')

const truffleConfig = require('../../truffle-config')

const FLATTEN_DIR = './flattened_contracts'

module.exports = async (instance, { verbose = true, flattenContracts = true } = {}) => {
  const {
    contractName,
    sourcePath,
    updatedAt: compiledAt,
    compiler: { name: compilerName, version: compilerVersion }
  } = instance.constructor._json

  if (flattenContracts) {
    const flattenedCode = await flatten([ sourcePath ])
    mkdirp.sync(FLATTEN_DIR)
    const savePath = path.join(FLATTEN_DIR, `${contractName}.sol`)
    fs.writeFileSync(savePath, flattenedCode)
  }

  const optimizer = truffleConfig.solc.optimizer || null
  const optimizerStatus = optimizer && optimizer.enabled ? `${optimizer.runs} runs`: 'Disabled'

  if (!verbose) {
    console.log(`Deployed ${contractName}: ${instance.address}`)
  } else {
    console.log('=========')
    console.log(`# ${contractName}:`)
    console.log(`Address: ${instance.address}`)
    console.log(`Transaction hash: ${instance.transactionHash}`)
    console.log(`Compiler: ${compilerName}@${compilerVersion} (Optimizer: ${optimizerStatus})`)
    console.log(`Compiled at: ${compiledAt}`)
    console.log('=========')
  }
}