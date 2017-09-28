const namehash = require('eth-ens-namehash').hash

const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const BaseFactory = artifacts.require('BaseFactory')
const EtherToken = artifacts.require('EtherToken')

const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')

const getContract = (name) =>
  artifacts.require(name)

module.exports = (deployer, network) => {
  const isLive = ['mainnet', 'kovan', 'ropsten'].indexOf(network) > -1

  const apps = [
    { name: 'VotingApp', appId: 'voting.aragonpm.eth' },
    { name: 'TokenManager', appId: 'token-manager.aragonpm.eth' },
    { name: 'GroupApp', appId: 'group.aragonpm.eth' },
    { name: 'FundraisingApp', appId: 'fundraising.aragonpm.eth' },
    { name: 'Vault', appId: 'vault.aragonpm.eth' },
    { name: 'FinanceApp', appId: 'finance.aragonpm.eth' },
  ]

  const appContracts = apps.map(app => app.name).map(getContract)
  const appIds = apps.map(app => app.appId).map(namehash)

  deployer.deploy(Kernel)
    .then(() => {
        // Deploy contracts serially to avoid nonce duplication issue
        return appContracts.reduce((promise, contract) => {
            return promise.then(() => deployer.deploy(contract))
        }, Promise.resolve())
    })
    .then(() => {
      console.log('Apps')
      console.log('----------------------------------------------------------------')
      appContracts.map((app) => {
        console.log(app.contract_name, app.address)
      })
    })
    .then(() => deployer.deploy(MiniMeTokenFactory))
    .then(() => deployer.deploy(EtherToken))
    .then(() => {
        console.log('Deploying Factory')

        const appAddresses = appContracts.map(contract => contract.address)
        return deployer.deploy(BaseFactory, Kernel.address, appIds, appAddresses, EtherToken.address, MiniMeTokenFactory.address)
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
