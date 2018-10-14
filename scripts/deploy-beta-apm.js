const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const deployENS = require('./deploy-beta-ens')
const deployDaoFactory = require('./deploy-daofactory')
const logDeploy = require('./helpers/create-logger')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const defaultOwner = process.env.OWNER || '0x4cb3fd420555a09ba98845f0b816e45cfb230983'
const defaultDaoFactoryAddress = process.env.DAO_FACTORY
const defaultENSAddress = process.env.ENS

const deployBases = async (baseContracts, verbose) => {
  const deployments = baseContracts.map(
    async (contract) => {
      const instance = await contract.new()
      logDeploy(instance, verbose)
      return instance
    }
  )
  const deployedContracts = await Promise.all(deployments)
  return deployedContracts.map(c => c.address)
}

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    ensAddress = defaultENSAddress,
    owner = defaultOwner,
    daoFactoryAddress = defaultDaoFactoryAddress,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const APMRegistry = artifacts.require('APMRegistry')
  const Repo = artifacts.require('Repo')
  const ENSSubdomainRegistrar = artifacts.require('ENSSubdomainRegistrar')

  const DAOFactory = artifacts.require('DAOFactory')
  const APMRegistryFactory = artifacts.require('APMRegistryFactory')
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
  const apmBases = await deployBases([APMRegistry, Repo, ENSSubdomainRegistrar], verbose)

  let daoFactory
  if (daoFactoryAddress) {
    daoFactory = DAOFactory.at(daoFactoryAddress)
    const hasEVMScripts = await daoFactory.regFactory() !== ZERO_ADDR

    log(`Using provided DAOFactory (with${hasEVMScripts ? '' : 'out' } EVMScripts):`, daoFactoryAddress)
  } else {
    log('Deploying DAOFactory with EVMScripts...')
    daoFactory = (await deployDaoFactory(null, { artifacts, withEvmScriptRegistryFactory: true, verbose: false })).daoFactory
  }

  log('Deploying APMRegistryFactory...')
  const apmFactory = await APMRegistryFactory.new(daoFactory.address, ...apmBases, ensAddress, '0x00')
  logDeploy(apmFactory, verbose)

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
  log('# APM:')
  log('Address:', apmAddr)
  log('Transaction hash:', receipt.tx)
  log('=========')
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
