const abi = require('web3-eth-abi')

module.exports = {
    decodeEventsOfType: (receipt, contractAbi, eventName) => {
        const eventAbi = contractAbi.filter(abi => abi.name === eventName && abi.type === 'event')[0]
        const eventSignature = abi.encodeEventSignature(eventAbi)
        const eventLogs = receipt.logs.filter(l => l.topics[0] === eventSignature)
        return eventLogs.map(log => {
            log.event = eventAbi.name
            log.args = abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1))
            return log
        })
    }
}
