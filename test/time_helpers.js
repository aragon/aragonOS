contract('TimeHelpers test', accounts => {
  let timeHelpersMock

  before(async () => {
    timeHelpersMock = await artifacts.require('TimeHelpersMock').new()
  })

  it('checks block number', async () => {
    assert.equal((await timeHelpersMock.getBlockNumberExt.call()).toString(), (await timeHelpersMock.getBlockNumber64Ext.call()).toString(), "block numbers should match")
    assert.equal((await timeHelpersMock.getBlockNumberExt.call()).toString(), (await timeHelpersMock.getBlockNumberDirect.call()).toString(), web3.eth.blockNumber, "block number should match with real one", "block number should match with real one")
  })

  it('checks time stamp', async () => {
    const timestamp = await timeHelpersMock.getTimestampExt.call()
    const timestamp64 = await timeHelpersMock.getTimestamp64Ext.call()
    const timestampReal = await timeHelpersMock.getTimestampDirect.call()

    const timestamp64Diff = timestamp64.minus(timestamp)
    const timestampRealDiff = timestampReal.minus(timestamp)
    assert.isTrue(timestamp64Diff.lessThanOrEqualTo(1), "time stamps should match (or be very close to)")
    assert.isTrue(timestampRealDiff.lessThanOrEqualTo(1), "time stamp should match with real one (or be very close to)")
  })
})
