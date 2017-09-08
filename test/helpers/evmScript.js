const abi = require('ethereumjs-abi')

module.exports = {
    encodeScript: actions => {
        return actions.reduce((acc, { to, calldata }) => {
            const addr = abi.rawEncode(['address'], [to]).toString('hex')
            const length = abi.rawEncode(['uint256'], [(calldata.length - 2) / 2]).toString('hex')

            // Remove 12 first 0s for addr and 28 0s for uint32 length
            return acc + addr.slice(24) + length.slice(56) + calldata.slice(2)
        }, '0x')
    }
}
