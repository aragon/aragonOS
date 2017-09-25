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
const namehash = require('eth-ens-namehash').hash

const getContract = x => artifacts.require(x)
const flatten = x => [].concat.apply([], x)
const contractName = p => path.basename(p).split('.')[0]

const metadataDir = './metadata'
const artifactsDir = './artifacts'

// Uses solidity-inspector to extract info about a contract file
const analyzeContract = file => {
    const filePath = path.join(process.cwd(), 'contracts', file)
    const functions = inspector.parseFile(filePath).toJSON().functions

    return Object.keys(functions)
        .map(key => functions[key])
        .filter(fn => fn.accessModifier != 'internal' && fn.accessModifier != 'private')
}

// Takes a metadata file and saves an artifact file
const generateArtifacts = name => {
    fs.readFile(path.join(metadataDir, name), 'utf8', async (err, fileContent) => {
        if (err) throw err
        const metadata = JSON.parse(fileContent)
        const functions = analyzeContract(metadata.path)
        const contract = getContract(contractName(name))

        delete metadata.path

        metadata.functions = functions.map(f => {
            const authMod = f.modifiers.filter(m => m.name == 'auth')[0]
            const roleNeeded = authMod ? authMod.params[0] : null
            let params = Object.values(f.params)
            params.forEach(p => delete p.typeHint)

            return { name: f.name, notice: f.notice, params, roleNeeded }
        })

        metadata.appId = namehash(metadata['appName'])

        metadata.deployedNetwork = contract.network_id
        metadata.deployedAddress = contract.address

        metadata.abi = contract.abi
        metadata.bytecode = contract.unlinked_binary

        const instance = contract.at(contract.address)
        const rolesBytes = await Promise.all(metadata.roles.map(r => instance[r.id]()))

        rolesBytes.forEach((b, i) => {
            metadata.roles[i].bytes = b
        })

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
          generateArtifacts(file)
      })
    })
}
