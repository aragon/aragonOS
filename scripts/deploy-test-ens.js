const logDeploy = require('./helpers/deploy-logger')
const { promisify } = require('util')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const defaultOwner = process.env.OWNER

module.exports = async (truffleExecCallback, { artifacts = globalArtifacts, owner = defaultOwner, verbose = true } = {}) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  if (!owner) {
    const accounts = await promisify(web3.eth.getAccounts)()
    owner = accounts[0]
    log(`No OWNER environment variable passed, setting ENS owner to provider's account: ${owner}`)
  }

  const ENS = artifacts.require('ENS')
  const ENSFactory = artifacts.require('ENSFactory')

  log('Deploying ENSFactory...')
  const factory = await ENSFactory.new()
  await logDeploy(factory, { verbose })
  const receipt = await factory.newENS(owner)

  const ensAddr = receipt.logs.filter(l => l.event == 'DeployENS')[0].args.ens
  log('====================')
  log('Deployed ENS:', ensAddr)

  log(ensAddr)

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return {
      ens: ENS.at(ensAddr),
      ensFactory: factory,
    }
  }
}

