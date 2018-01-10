const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const getContract = name => artifacts.require(name)

const bases = ['APMRegistry', 'Repo', 'ENSSubdomainRegistrar']
const baseContracts = bases.map(getContract)

module.exports = async (deployer, network, accounts) => {
    console.log('deploying bases:')
    await deployer.deploy(baseContracts)

    const baseDeployed = baseContracts.map(c => c.address)

    // TODO: Take into account networks with ENS deployed
    const ENSFactory = getContract('ENSFactory')
    await deployer.deploy(ENSFactory)

    const APMRegistryFactory = getContract('APMRegistryFactory')
    const ensAddr = '0x0' // so ensfactory creates one

    await deployer.deploy(APMRegistryFactory, ...baseDeployed, ensAddr, ENSFactory.address)
    const factory = await APMRegistryFactory.deployed()

    console.log('deploying apm:')
    const r = await factory.newAPM(namehash('eth'), keccak256('aragonpm'), accounts[0], { gas: 7e6 })
    console.log(r)
}
