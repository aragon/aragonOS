const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const { signatures } = require('../test/helpers/web3')
const inspector = require('../../../../../solidity-inspector')

const factoryTemplate = path.join(process.cwd(), '../contracts/factories/BasicFactory.sol.tmpl')
const resultFile = path.join(process.cwd(), '../contracts/factories/BasicFactory.sol')

const getContract = x => artifacts.require(x)

const organNames = ['organs/MetaOrgan.sol', 'organs/VaultOrgan.sol', 'organs/ActionsOrgan.sol']
const appNames = ['apps/bylaws/BylawsApp.sol', 'apps/ownership/OwnershipApp.sol', 'apps/status/StatusApp.sol', 'apps/basic-governance/VotingApp.sol']
const excludeOrgans = ['IOrgan'].map(getContract)
const excludeApps = ['Application'].map(getContract)

const getBylaws = (f) => {
    const filePath = path.join(process.cwd(), '../contracts', f)
    const functions = inspector.parseFile(filePath).toJSON().functions
    return Object.keys(functions)
                .map(k => functions[k])
                .map(x => ({ name: x.name, bylaw: x.bylaw }))
                .filter(x => x.bylaw)
}

console.log(getBylaws(organNames[0]))

const contractName = p => path.basename(p).split('.')[0].toLowerCase()

module.exports = (done) => {
    fs.readFile(factoryTemplate, { encoding: 'utf-8'}, (err, file) => {
        const template = Handlebars.compile(file)

        const organData = organNames.map((o, i) => (
            { name: contractName(o), sigs: signatures(getContract(o), excludeOrgans, web3, true) }
        ))

        const appData = appNames.map((a, i) => (
            { name: contractName(a), sigs: signatures(getContract(a), excludeApps, web3, true) }
        ))

        appData[appData.length-1].last = true

        const data = {
            disclaimer: 'This is an automatically generated file. Please edit BasicFactory.sol.tmpl or the generate_factory.js script',
            apps: appData,
            organs: organData,
        }

        const content = template(data)
        fs.writeFile(resultFile, content, err => {
            if (err) return console.log('Error', err)
            console.log('Saved', resultFile)
        })
    })
}
