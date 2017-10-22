const namehash = require('eth-ens-namehash').hash

const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const BaseFactory = artifacts.require('BaseFactory')
const EtherToken = artifacts.require('EtherToken')
const RepoRegistry = artifacts.require('RepoRegistry')
const ENS = artifacts.require('AbstractENS')


const ensArtifacts = require('@aragon/apm-contracts/build/contracts/ENS')

const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')

const getContract = (name) =>
  artifacts.require(name)

const getNetworkId = () => {
    return new Promise((resolve, reject) => {
       web3.version.getNetwork((err, res) => {
        if (err || !res) return reject(err)
        resolve(res)
      })
    })
}

module.exports = async (deployer, network) => {
  const apmName = 'aragonpm.test'
  let ensAddress = '0x'

  const isLive = ['mainnet', 'kovan', 'ropsten'].indexOf(network) > -1

  const apps = ['Voting', 'TokenManager', 'Group', 'Fundraising', 'Vault', 'Finance']
  const appMetadata = apps.map(app => require(`../metadata/${app}`))

  const appContracts = apps.map(getContract)
  const appIds = appMetadata.map(metadata => metadata.appName).map(namehash)

  return
  
  deployer.deploy(Kernel)
    .then(() => {
        // Deploy contracts serially to avoid nonce duplication issue
        return appContracts.reduce((promise, contract) => {
            return promise.then(() => deployer.deploy(contract))
        }, Promise.resolve())
    })
    .then(() => getNetworkId())
    .then(networkId => {
      console.log('Apps')
      console.log('----------------------------------------------------------------')
      appContracts.map((app) => {
        console.log(app.contract_name, app.address)
      })

      if (!ensArtifacts.networks[networkId])
        throw new Error('Please run migrations on apm-contracts on this network')

      ensAddress = ensArtifacts.networks[networkId].address
      return ENS.at(ensAddress).resolver.call(namehash(apmName))
    }).then(registryAddress => {
        console.log('ENS address:', ensAddress)
        console.log('APM address:', registryAddress)
        const apm = RepoRegistry.at(registryAddress)

        return appContracts.reduce((promise, contract, i) => {
          const appName = appMetadata[i].appName
          if (appName.indexOf(apmName) < 0)
            throw new Error("Attempting to publish app to different repository")

          const packageName = appName.split('.').shift()
          const version = appMetadata[i].version.split('.').map(x => parseInt(x))

          return promise.then(() => apm.newRepoWithVersion(packageName, version, contract.address, 'ipfs:'))
        }, Promise.resolve())
    })
    .then(() => deployer.deploy(MiniMeTokenFactory))
    .then(() => deployer.deploy(EtherToken))
    .then(() => {
        console.log('Deploying Factory')
        return deployer.deploy(BaseFactory, ensAddress, Kernel.address, appIds, EtherToken.address, MiniMeTokenFactory.address)
    })
    .then(() => BaseFactory.deployed())
    .then(factory => {
        console.log('Deploying DAO with Factory')
        return factory.deploy('Test Organization Token', 'TOT')
    }).then(result => {
        const deployment = result.logs.filter(log => log.event == 'DAODeploy')[0].args
        console.log('Deployed DAO:', deployment.dao)
        console.log('Organization token:', deployment.token)
        console.log('Gas used:', result.receipt.gasUsed)
    })
}
