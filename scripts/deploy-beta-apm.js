const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const APMRegistryFactory = artifacts.require('APMRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const ENS = artifacts.require('ENS')

const owner = process.env.OWNER || '0x4cb3fd420555a09ba98845f0b816e45cfb230983'
const ens = process.env.ENS || '0xfbae32d1cde62858bc45f51efc8cc4fa1415447e'

const tld = namehash('eth')
const label = '0x'+keccak256('aragonpm')

const getContract = name => artifacts.require(name)
const deployBases = async baseNames => {
  const baseContracts = await Promise.all(baseNames.map(c => getContract(c).new()))

  return baseContracts.map(c => c.address)
}

module.exports = async callback => {
  console.log('Deploying APM')
  console.log('Owner:', owner)
  console.log('ENS:', ens)
  console.log('TLD:', tld)
  console.log('Label:', label)

  console.log('=========')
  console.log('deploying APM bases')
  const apmBases = await deployBases(['APMRegistry', 'Repo', 'ENSSubdomainRegistrar'])
  console.log('deployed APM bases', apmBases)

  console.log('deploying DAO bases')
  const daoBases = await deployBases(['Kernel', 'ACL'])
  console.log('deployed DAO bases', daoBases)

  console.log('deploying DAOFactory')
  const evmScriptRegistry = '0x00' // Basic APM needs no forwarding
  const daoFactory = await DAOFactory.new(...daoBases, evmScriptRegistry)
  console.log('deployed DAOFactory', daoFactory.address)

  console.log('deploying APMRegistryFactory')
  const apmFactory = await APMRegistryFactory.new(daoFactory.address, ...apmBases, ens, '0x00')
  console.log('deployed APMRegistryFactory', apmFactory.address)

  console.log('assigning ENS name to factory')
  await ENS.at(ens).setSubnodeOwner(tld, label, apmFactory.address)

  console.log('deploying APM')
  const receipt = await apmFactory.newAPM(tld, label, owner)

  console.log('=========')
  const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
  console.log('deployed APM:', apmAddr)
  console.log(apmAddr)
}

// Rinkeby APM: 0x700569b6c99b8b5fa17b7976a26ae2f0d5fd145c
