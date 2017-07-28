const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const { signatures } = require('../test/helpers/web3')
const inspector = require('../../../../../solidity-inspector')

const factoryTemplate = path.join(process.cwd(), '../contracts/factories/BasicFactory.sol.tmpl')
const resultFile = path.join(process.cwd(), '../contracts/factories/BasicFactory.sol')

const getContract = x => artifacts.require(x)
const flatten = x => [].concat.apply([], x)

const organNames = ['organs/MetaOrgan.sol', 'organs/VaultOrgan.sol', 'organs/ActionsOrgan.sol']
const appNames = ['apps/bylaws/BylawsApp.sol', 'apps/ownership/OwnershipApp.sol', 'apps/status/StatusApp.sol', 'apps/basic-governance/VotingApp.sol']
const excludeOrgans = ['IOrgan'].map(getContract)
const excludeApps = ['Application'].map(getContract)

const parseBylaw = bylaw => {
    const args = bylaw.split(':')
    if (args.length != 2) return console.log('Invalid bylaw syntax', bylaw)

    let dir = {}
    dir[args[0]] = args[1].split(',')
    return dir
}

const flattenBylaws = x => {
    let bylaws = {}
    flatten(x)
        .forEach(x => bylaws[x.bylaw] = !bylaws[x.bylaw] ? [x.name] : bylaws[x.bylaw].concat([x.name]))

    return Object.keys(bylaws)
        .map((k, i) => ({id: i + 1, bylaw: parseBylaw(k), functions: bylaws[k] }))
}

const getBylaws = (f) => {
    const filePath = path.join(process.cwd(), 'contracts', f)
    const functions = inspector.parseFile(filePath).toJSON().functions

    return Object.keys(functions).map(k => functions[k])
                .filter(x => x.bylaw)
}

const assignBylaw = (bylaws, fn) => {
    for (var bylaw of bylaws) {
        for (var _fn of bylaw.functions) {
            // remove [] as solidity-parser fails to get array types
            if (fn.name.replace(/\[\]/g, '') == _fn) {
                fn.bylaw = bylaw.id
                return fn
            }
        }
    }
    return fn
}

const contractName = p => path.basename(p).split('.')[0].toLowerCase()

module.exports = (done) => {
    fs.readFile(factoryTemplate, { encoding: 'utf-8'}, (err, file) => {
        const template = Handlebars.compile(file)

        const bylaws = flattenBylaws(organNames.concat(appNames).map(getBylaws))

        const organData = organNames.map((o, i) => {
            const sigs = signatures(getContract(o), excludeOrgans, web3, true)
            return { name: contractName(o), sigs: sigs.map(x => assignBylaw(bylaws, x)) }
        })

        const appData = appNames.map((a, i) => {
            const sigs = signatures(getContract(a), excludeApps, web3, true)
            return { name: contractName(a), sigs: sigs.map(x => assignBylaw(bylaws, x)) }
        })

        appData[appData.length-1].last = true

        const data = {
            disclaimer: 'This is an automatically generated file. Please edit BasicFactory.sol.tmpl or the generate_factory.js script',
            apps: appData,
            organs: organData,
            bylaws: bylaws,
        }

        const content = template(data)
        fs.writeFile(resultFile, content, err => {
            if (err) return console.log('Error', err)
            console.log('Saved', resultFile)
            done()
        })
    })
}
