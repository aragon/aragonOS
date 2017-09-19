/**
* Takes files in metadata/*.json and generates final metadata file by adding:
*  - Build results (ABI and Bytecode)
*  - Migration results (deployed instance address)
*  - Natspec and auth role per function
*/

const fs = require('fs')
const path = require('path')
const { signatures } = require('../test/helpers/web3')
const inspector = require('solidity-inspector')

const getContract = x => artifacts.require(x)
const flatten = x => [].concat.apply([], x)
const contractName = p => path.basename(p).split('.')[0]

const metadataDir = './metadata'
const artifactsDir = './artifacts'

const analizeContract = (f) => {
    const filePath = path.join(process.cwd(), 'contracts', f)
    const functions = inspector.parseFile(filePath).toJSON().functions

    return Object.keys(functions)
        .map(k => functions[k])
        .filter(f => f.accessModifier != 'internal' && f.accessModifier != 'private')
}

const processFile = name => {
    fs.readFile(path.join(metadataDir, name), 'utf8', (err, f) => {
        if (err) throw err
        const metadata = JSON.parse(f)
        const functions = analizeContract(metadata.path)
        const contract = getContract(contractName(name))

        delete metadata.path

        metadata.functions = functions.map(f => {
            const authMod = f.modifiers.filter(m => m.name == 'auth')[0]
            const roleNeeded = authMod ? authMod.params[0] : undefined
            let params = Object.values(f.params)
            params.forEach(p => delete p.typeHint)

            return { name: f.name, notice: f.notice, params , roleNeeded }
        })

        metadata.deployedNetwork = contract.network_id
        metadata.deployedAddress = contract.address

        metadata.abi = contract.abi
        metadata.bytecode = contract.unlinked_binary

        if (!fs.existsSync(artifactsDir)){
            fs.mkdirSync(artifactsDir);
        }

        const file = path.join(artifactsDir, name)
        fs.writeFile(file, JSON.stringify(metadata, null, 4), err => {
            if (err) throw err
            console.log(file, 'saved')
        })
    })
}

module.exports = (done) => {
    fs.readdir(metadataDir, (err, files) => {
      files.forEach(file => {
          processFile(file)
      })
    })
}
