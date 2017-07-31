const BasicFactory = artifacts.require('BasicFactory')
const ForwarderFactory = artifacts.require('ForwarderFactory')
const Kernel = artifacts.require('Kernel')

const getContract = x => artifacts.require(x)

const liveNetworks = ['kovan', 'ropsten']
const firstInstalls = ['ForwarderFactory', 'MetaOrgan'].map(getContract)
const normalInstall = ['VaultOrgan', 'ActionsOrgan', 'BylawsApp', 'OwnershipApp', 'StatusApp', 'VotingApp'].map(getContract)

module.exports = (deployer, network) => {
    const isLive = liveNetworks.indexOf(network) > -1

    deployer.deploy(firstInstalls.concat(normalInstall))
        .then(() => deployer.deploy(Kernel, firstInstalls[1].address))
        .then(() => {
            const parameters = [Kernel].concat(firstInstalls).concat(normalInstall)
            const deployAddrs = parameters.map(x => x.address)
            return deployer.deploy.apply(deployer, [BasicFactory].concat(deployAddrs))
        })
        .then(() => {
            return BasicFactory.at(BasicFactory.address).create('Test Token', 'TST', !isLive).then(x => console.log('[test] Deployed DAO', x.logs[0].args.dao, 'gas:', x.receipt.gasUsed))
        })
}
