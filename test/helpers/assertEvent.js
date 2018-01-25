module.exports = (receipt, eventName, instances = 1) => {
    const events = receipt.logs.filter(x => x.event == eventName)
    assert.equal(events.length, instances, `'${eventName}' event should have been fired ${instances} times`)
}
