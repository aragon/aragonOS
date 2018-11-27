const abi = require('web3-eth-abi')

module.exports = {
    decodeEventsOfType: (receipt, eventAbi) => {
        const eventSignature = abi.encodeEventSignature(eventAbi)
        const eventLogs = receipt.logs.filter(l => l.topics[0] === eventSignature)
        return eventLogs.map(log => {
            log.event = abi.name
            log.args = abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1))
            return log
        })
    }
}
