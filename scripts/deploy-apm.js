const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const deployENS = require('./deploy-test-ens')
const deployDaoFactory = require('./deploy-daofactory')
const logDeploy = require('./helpers/deploy-logger')
const getAccounts = require('./helpers/get-accounts')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle
const globalWeb3 = this.web3 // Not injected unless called directly via truffle

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

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
  const apmNode = namehash(`${labelName}.${tldName}`)

  let ens

  log('Deploying APM...')

  const accounts = await getAccounts(web3)
  if (!owner) {
    owner = accounts[0]
    log('OWNER env variable not found, setting APM owner to the provider\'s first account')
  }
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

  const apmRegistryBase = await APMRegistry.new()
  await logDeploy(apmRegistryBase, { verbose })
  const apmRepoBase = await Repo.new()
  await logDeploy(apmRepoBase, { verbose })
  const ensSubdomainRegistrarBase = await ENSSubdomainRegistrar.new()
  await logDeploy(ensSubdomainRegistrarBase, { verbose })

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
  const apmFactory = await APMRegistryFactory.new(
    daoFactory.address,
    apmRegistryBase.address,
    apmRepoBase.address,
    ensSubdomainRegistrarBase.address,
    ensAddress,
    '0x00'
  )
  await logDeploy(apmFactory, { verbose })

  log(`Assigning ENS name (${labelName}.${tldName}) to factory...`)

  if (await ens.owner(apmNode) === accounts[0]) {
    log('Transferring name ownership from deployer to APMRegistryFactory')
    await ens.setOwner(apmNode, apmFactory.address)
  } else {
    log('Creating subdomain and assigning it to APMRegistryFactory')
    try {
      await ens.setSubnodeOwner(tldHash, labelHash, apmFactory.address)
    } catch (err) {
      console.error(
        `Error: could not set the owner of '${labelName}.${tldName}' on the given ENS instance`,
        `(${ensAddress}). Make sure you have ownership rights over the subdomain.`
      )
      throw err
    }
  }

  log('Deploying APM...')
  const receipt = await apmFactory.newAPM(tldHash, labelHash, owner)

  log('=========')
  const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
  log('# APM:')
  log('Address:', apmAddr)
  log('Transaction hash:', receipt.tx)
  log('=========')

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
