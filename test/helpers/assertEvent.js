const { isAddress } = require('web3-utils')
const { getEventAt, getEvents } = require('./events')

module.exports = web3 => {
    const assertEvent = (receipt, eventName, expectedArgs = {}, index = 0) => {
        const event = getEventAt(receipt, eventName, index)
        assert(typeof event === 'object', `could not find an emitted ${eventName} event ${index === 0 ? '' : `at index ${index}`}`)

        for (const arg of Object.keys(expectedArgs)) {
            let foundArg = event.args[arg]
            if (foundArg instanceof web3.BigNumber) foundArg = foundArg.toString()
            else if (isAddress(foundArg)) foundArg = foundArg.toLowerCase()

            let expectedArg = expectedArgs[arg]
            if (expectedArg instanceof web3.BigNumber) expectedArg = expectedArg.toString()
            else if (isAddress(expectedArg)) expectedArg = expectedArg.toLowerCase()

            assert.equal(foundArg, expectedArg, `${eventName} event ${arg} value does not match`)
        }
    }

    const assertAmountOfEvents = (receipt, eventName, expectedAmount = 1) => {
        const events = getEvents(receipt, eventName)
        assert.equal(events.length, expectedAmount, `number of ${eventName} events does not match`)
    }

    return {
        assertEvent,
        assertAmountOfEvents
    }
}
