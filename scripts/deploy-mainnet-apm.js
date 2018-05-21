const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const APMRegistryFactory = artifacts.require('APMRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const ENS = artifacts.require('ENS')

const owner = '0x2dc1ccf1c83d6760f93adbd66997b56a267ce01a'
const ens = '0x314159265dD8dbb310642f98f50C066173C1259b'

const tld = namehash('eth')
const label = '0x'+keccak256('aragonpm')
const node = namehash('aragonpm.eth')

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
  // const apmBases = await deployBases(['APMRegistry', 'Repo', 'ENSSubdomainRegistrar'])
  const apmBases = [ '0xf5174528211211a667243edc8579f2042124895c',
  '0xf626624a4c25b053dcce35d6ed2efcec46b19b56',
  '0x6702f32e9abd64961fbbf123aed450ac0da65853' ]
  console.log('deployed APM bases', apmBases)

  console.log('deploying DAO bases')
  // const daoBases = await deployBases(['Kernel', 'ACL'])
  const daoBases = [ '0xe214ca721720019a81c889a59124f168be632e94',
  '0xb104e51f872788e0c2742e7098e2a792b9569d56' ]
  console.log('deployed DAO bases', daoBases)

  console.log('deploying DAOFactory')
  const evmScriptRegistry = '0x00' // Basic APM needs no forwarding
  // const daoFactory = await DAOFactory.new(...daoBases, evmScriptRegistry)
  const daoFactory = DAOFactory.at('0x7b6bddc7fa88f1340fad3b4cb0b267e0314ab76b')
  console.log('deployed DAOFactory', daoFactory.address)

  console.log('deploying APMRegistryFactory')
  const apmFactory = await APMRegistryFactory.new(daoFactory.address, ...apmBases, ens, '0x00')
  const apmFactory = APMRegistryFactory.at('0x66926276f7ba5d9d17015c822e0e8ad3773f20f4')
  console.log('deployed APMRegistryFactory', apmFactory.address)

  return

  console.log('assigning ENS name to factory')
  await ENS.at(ens).setOwner(node, apmFactory.address)

  console.log('deploying APM')
  const receipt = await apmFactory.newAPM(tld, label, owner)

  console.log('=========')
  const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
  console.log('deployed APM:', apmAddr)
  console.log(apmAddr)
}

// Rinkeby APM: 0x700569b6c99b8b5fa17b7976a26ae2f0d5fd145c
