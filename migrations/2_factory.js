const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

const getContract = (name) =>
  artifacts.require(name)

module.exports = (deployer, network) => {
  const isLive = ['kovan', 'ropsten'].indexOf(network) > -1

  const apps = [
    'VotingApp',
    'Vault',
    'TokenManager'
  ].map(getContract)

  deployer.deploy(Kernel)
    .then(() => deployer.deploy(KernelProxy, Kernel.address))
    .then(() => deployer.deploy(apps))
    .then(() => {
      if (isLive) return

      console.log('DAO was deployed', KernelProxy.address)
      console.log()
      console.log('Apps')
      console.log('----------------------------------------------------------------')
      apps.map((app) => {
        console.log(app.contract_name, app.address)
      })
    })
}
