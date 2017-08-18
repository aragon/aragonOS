const fs = require('fs')
const path = require('path')
const { signatures } = require('../test/helpers/web3')
const inspector = require('solidity-inspector')

const getContract = x => artifacts.require(x)
const flatten = x => [].concat.apply([], x)

const resultFile = path.join(process.cwd(), '../functions.csv')

const organNames = ['organs/MetaOrgan.sol', 'organs/VaultOrgan.sol', 'organs/ActionsOrgan.sol']
const appNames = ['apps/bylaws/BylawsApp.sol', 'apps/ownership/OwnershipApp.sol', 'apps/status/StatusApp.sol', 'apps/basic-governance/VotingApp.sol']
const excludeOrgans = ['IOrgan'].map(getContract)
const excludeApps = ['Application'].map(getContract)

const analizeContract = (f) => {
    const filePath = path.join(process.cwd(), 'contracts', f)
    const functions = inspector.parseFile(filePath).toJSON().functions

    return Object.keys(functions)
        .map(k => functions[k])
        .filter(f => f.accessModifier != 'internal' && f.accessModifier != 'private')
}

const contractName = p => path.basename(p).split('.')[0]

module.exports = (done) => {
    const organData = organNames.map(n => {
        const d = analizeContract(n)
        return { name: contractName(n), functions: d.map(f => f.name) }
    })

    const appData = appNames.map(n => {
        const d = analizeContract(n)
        return { name: contractName(n), functions: d.filter(f => f.modifiers.indexOf('onlyDAO') > -1).map(f => f.name) }
    })

    let content = 'Component,Function,Permissions,Notes\n'
    for (const organ of organData) {
        content += `${organ.name},,,\n`
        for (const f of organ.functions) {
            content += `,"${f}",,\n`
        }
    }

    for (const app of appData) {
        content += `${app.name},,,\n`
        for (const f of app.functions) {
            content += `,"${f}",,\n`
        }
    }

    fs.writeFile(resultFile, content, err => {
        if (err) console.log(err)
        done()
    })
}
