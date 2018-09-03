const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const defaultOwner = process.env.OWNER || '0x4cb3fd420555a09ba98845f0b816e45cfb230983'

module.exports = async (truffleExecCallback, { artifacts = globalArtifacts, owner = defaultOwner, verbose = true } = {}) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const ENS = artifacts.require('ENS')
  const ENSFactory = artifacts.require('ENSFactory')

  log('Deploying ENSFactory...')
  const factory = await ENSFactory.new()
  log('ENSFactory deployed:', factory.address)
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

// Rinkeby ENS: 0xfbae32d1cde62858bc45f51efc8cc4fa1415447e
