const { signatures } = require('./web3')
var IOrgan = artifacts.require('IOrgan')
var Application = artifacts.require('Application')

module.exports = {
  async installOrgans(metadao, organs) {
    const installs = organs.map(async (o) => {
        const deployedOrgan = await o.new()
        await metadao.installOrgan(deployedOrgan.address, signatures(o, [IOrgan], web3))
        return deployedOrgan
    })

    return Promise.all(installs)
  },

  async installApps(metadao, apps) {
    const installs = apps.map(async (a) => {
        const deployedApp = await a.new(metadao.address)
        await metadao.installApp(deployedApp.address, signatures(a, [Application], web3))
        return deployedApp
    })

    return Promise.all(installs)
  },
}
