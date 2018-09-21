const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const deployENS = require('./deploy-beta-ens')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const defaultOwner = process.env.OWNER || '0x4cb3fd420555a09ba98845f0b816e45cfb230983'
const defaultENSAddress = process.env.ENS

const baseInitArguments = {
  Kernel: [ true ] // petrify
}

const deployBases = async baseContracts => {
  const deployedContracts = await Promise.all(baseContracts.map(c => c.new(...(baseInitArguments[c.contractName] || []))))
  return deployedContracts.map(c => c.address)
}

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    ensAddress = defaultENSAddress,
    owner = defaultOwner,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const ACL = artifacts.require('ACL')
  const Kernel = artifacts.require('Kernel')
  const APMRegistry = artifacts.require('APMRegistry')
  const Repo = artifacts.require('Repo')
  const ENSSubdomainRegistrar = artifacts.require('ENSSubdomainRegistrar')

  const APMRegistryFactory = artifacts.require('APMRegistryFactory')
  const DAOFactory = artifacts.require('DAOFactory')
  const ENS = artifacts.require('ENS')

  const tldName = 'eth'
  const labelName = 'aragonpm'
  const tldHash = namehash(tldName)
  const labelHash = '0x'+keccak256(labelName)

  let ens

  log('Deploying APM...')
  log('Owner:', owner)

  if (!ensAddress) {
    log('=========')
    log('Missing ENS! Deploying a custom ENS...')
    ens = (await deployENS(null, { artifacts, owner, verbose: false })).ens
    ensAddress = ens.address
  } else {
    ens = ENS.at(ensAddress)
  }

  log('ENS:', ensAddress)
  log(`TLD: ${tldName} (${tldHash})`)
  log(`Label: ${labelName} (${labelHash})`)

  log('=========')
  log('Deploying APM bases...')
  const apmBases = await deployBases([APMRegistry, Repo, ENSSubdomainRegistrar])
  log('Deployed APM bases:', apmBases)

  log('Deploying DAO bases...')
  const daoBases = await deployBases([Kernel, ACL])
  log('Deployed DAO bases', daoBases)

  log('Deploying DAOFactory without EVMScripts...')
  const evmScriptRegistry = '0x00' // Basic APM needs no forwarding
  const daoFactory = await DAOFactory.new(...daoBases, evmScriptRegistry)
  log('Deployed DAOFactory:', daoFactory.address)

  log('Deploying APMRegistryFactory...')
  const apmFactory = await APMRegistryFactory.new(daoFactory.address, ...apmBases, ensAddress, '0x00')
  log('Deployed APMRegistryFactory:', apmFactory.address)

  log(`Assigning ENS name (${labelName}.${tldName}) to factory...`)
  try {
    await ens.setSubnodeOwner(tldHash, labelHash, apmFactory.address)
  } catch (err) {
    console.error(
      `Error: could not set the owner of '${labelName}.${tldName}' on the given ENS instance`,
      `(${ensAddress}). Make sure you have ownership rights over the subdomain.`
    )
    throw err
  }

  log('Deploying APM...')
  const receipt = await apmFactory.newAPM(tldHash, labelHash, owner)

  log('=========')
  const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
  log('Deployed APM:', apmAddr)
  log(apmAddr)

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return {
      apmFactory,
      ens,
      apm: APMRegistry.at(apmAddr),
    }
  }
}

// Rinkeby APM: 0x700569b6c99b8b5fa17b7976a26ae2f0d5fd145c
