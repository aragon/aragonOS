const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const { signatures } = require('../test/helpers/web3')

const factoryTemplate = path.join(process.cwd(), '../contracts/factories/BasicFactory.sol.tmpl')
const resultFile = path.join(process.cwd(), '../contracts/factories/BasicFactory.sol')

const getContract = x => artifacts.require(x)

const organNames = ['MetaOrgan', 'VaultOrgan', 'ActionsOrgan']
const appNames = ['BylawsApp', 'OwnershipApp', 'StatusApp', 'VotingApp']
const excludeOrgans = ['IOrgan'].map(getContract)
const excludeApps = ['Application'].map(getContract)

module.exports = (done) => {
    fs.readFile(factoryTemplate, { encoding: 'utf-8'}, (err, file) => {
        const template = Handlebars.compile(file)

        const organData = organNames.map((o, i) => (
            { name: o.toLowerCase(), sigs: signatures(getContract(o), excludeOrgans, web3, true) }
        ))

        const appData = appNames.map((a, i) => (
            { name: a.toLowerCase(), sigs: signatures(getContract(a), excludeApps, web3, true) }
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
