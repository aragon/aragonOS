const truffleConfig = require('../../truffle-config')

module.exports = async (instance, verbose = true) => {
  const contract = instance.constructor._json.contractName
  const { name: compilerName, version: compilerVersion } = instance.constructor._json.compiler
  const compiledAt = instance.constructor._json.updatedAt

  const optimizer = truffleConfig.solc.optimizer || null
  const optimizerStatus = optimizer && optimizer.enabled ? `${optimizer.runs} runs`: 'Disabled'

  if (!verbose) {
    console.log(`Deployed ${contract}: ${instance.address}`)
  } else {
    console.log('=========')
    console.log(`# ${contract}:`)
    console.log(`Address: ${instance.address}`)
    console.log(`Transaction hash: ${instance.transactionHash}`)
    console.log(`Compiler: ${compilerName}@${compilerVersion} (Optimizer: ${optimizerStatus})`)
    console.log(`Compiled at: ${compiledAt}`)
    console.log('=========')
  }
}