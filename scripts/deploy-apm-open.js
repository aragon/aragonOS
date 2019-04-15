const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const deployAPM = require('./deploy-apm')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle
const globalWeb3 = this.web3 // Not injected unless called directly via truffle

const defaultOwner = process.env.OWNER
const defaultDaoFactoryAddress = process.env.DAO_FACTORY
const defaultENSAddress = process.env.ENS

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    web3 = globalWeb3,
    ensAddress = defaultENSAddress,
    owner = defaultOwner,
    daoFactoryAddress = defaultDaoFactoryAddress,
    verbose = true,
  } = {}
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const ENSSubdomainRegistrar = artifacts.require('ENSSubdomainRegistrar')

  const tldName = 'aragonpm.eth'
  const labelName = 'open'
  const tldHash = namehash(tldName)
  const labelHash = '0x' + keccak256(labelName)
  const apmNode = namehash(`${labelName}.${tldName}`)

  // wrap deploy-apm
  const { apmFactory, ens, apm } = await deployAPM(null, {
    artifacts,
    web3,
    ensAddress,
    daoFactoryAddress,
    verbose,
  })

  ensAddress = ens.address

  const apmENSSubdomainRegistrar = ENSSubdomainRegistrar.at(
    await apm.registrar()
  )

  log(`TLD: ${tldName} (${tldHash})`)
  log(`Label: ${labelName} (${labelHash})`)
  log('=========')

  log(`Assigning ENS name (${labelName}.${tldName}) to factory...`)
  try {
    await apmENSSubdomainRegistrar.createName(labelHash, apmFactory.address, {
      from: apm.address,
    })
  } catch (err) {
    console.error(
      `Error: could not set the owner of '${labelName}.${tldName}' on the given ENS instance`,
      `(${ensAddress}). Make sure you have ownership rights over the subdomain.`
    )
    throw err
  }

  log('Deploying Open APM...')
  const receipt = await apmFactory.newAPM(tldHash, labelHash, owner)

  log('=========')
  const openAPMAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args
    .apm
  log('# Open APM:')
  log('Address:', openAPMAddr)
  log('Transaction hash:', receipt.tx)
  log('=========')

  // TODO: Update target

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return {
      apmFactory,
      ens,
      apm: APMRegistry.at(openAPMAddr),
    }
  }
}
