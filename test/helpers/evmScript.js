const abi = require('ethereumjs-abi')

module.exports = {
    // Encodes an array of actions ({ to: address, calldata: bytes}) into the EVM call script format
    // Sets spec id 1 = 0x00000001 and
    // Concatenates per call [ 20 bytes (address) ] + [ 4 bytes (uint32: calldata length) ] + [ calldataLength bytes (payload) ]
    encodeCallScript: actions => {
        return actions.reduce((script, { to, calldata }) => {
            const addr = abi.rawEncode(['address'], [to]).toString('hex')
            const length = abi.rawEncode(['uint256'], [(calldata.length - 2) / 2]).toString('hex')

            // Remove 12 first 0s of padding for addr and 28 0s for uint32
            return script + addr.slice(24) + length.slice(56) + calldata.slice(2)
        }, '0x00000001') // spec 1
    },

    encodeDelegate: addr => '0x00000002' + addr.slice(2), // remove 0x from addr
    encodeDeploy: contract => '0x00000003' + contract.binary.slice(2),
}
