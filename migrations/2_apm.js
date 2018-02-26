const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

module.exports = async (deployer, network, accounts, arts = null) => {
  if (arts != null) artifacts = arts // allow running outside

  const getContract = name => artifacts.require(name)

  const bases = ['APMRegistry', 'Repo', 'ENSSubdomainRegistrar']
  const baseContracts = bases.map(getContract)

  await deployer.deploy(baseContracts)

  const baseDeployed = baseContracts.map(c => c.address)

  // TODO: Take into account networks with ENS deployed
  const ENSFactory = getContract('ENSFactory')
  await deployer.deploy(ENSFactory)

  const APMRegistryFactory = getContract('APMRegistryFactory')
  const ensAddr = '0x0' // so ensfactory creates one

  const kernelBase = await getContract('Kernel').new()
  const aclBase = await getContract('ACL').new()
  const daoFactory = await getContract('DAOFactory').new(kernelBase.address, aclBase.address, '0x00')

  await deployer.deploy(APMRegistryFactory, daoFactory.address, ...baseDeployed, ensAddr, ENSFactory.address)
  const factory = await APMRegistryFactory.deployed()


  console.log('Deploying APM...')
  const root = '0xffffffffffffffffffffffffffffffffffffffff' // public
  const receipt = await factory.newAPM(namehash('eth'), '0x'+keccak256('aragonpm'), root)
  const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
  console.log('Deployed APM at:', apmAddr)

  const apm = getContract('APMRegistry').at(apmAddr)
  console.log('Kernel:', await apm.kernel())

  const ensSub = getContract('ENSSubdomainRegistrar').at(await apm.registrar())
  console.log('ENS:', await ensSub.ens())

  return { apm, ensAddr: await ensSub.ens() }
}
