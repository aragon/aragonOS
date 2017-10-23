const abi = require('ethereumjs-abi')

module.exports = {
    // Encodes an array of actions ({ to: address, calldata: bytes}) into the EVM script format
    // Concatenates [ 20 bytes (address) ] + [ 4 bytes (uint32: calldata length) ] + [ calldataLength bytes (payload) ]
    encodeScript: actions => {
        return actions.reduce((script, { to, calldata }) => {
            const addr = abi.rawEncode(['address'], [to]).toString('hex')
            const length = abi.rawEncode(['uint256'], [(calldata.length - 2) / 2]).toString('hex')

            // Remove 12 first 0s of padding for addr and 28 0s for uint32
            return script + addr.slice(24) + length.slice(56) + calldata.slice(2)
        }, '0x')
    }
}