contract('TimeHelpers', () => {
  let timeHelpersMock

  before(async () => {
    timeHelpersMock = await artifacts.require('TimeHelpersMock').new()
  })

  it('checks block number', async () => {
    assert.equal((await timeHelpersMock.getBlockNumberExt()).toString(), (await timeHelpersMock.getBlockNumber64Ext()).toString(), "block numbers should match")
    assert.equal((await timeHelpersMock.getBlockNumberExt()).toString(), (await timeHelpersMock.getBlockNumberDirect()).toString(), web3.eth.blockNumber, "block number should match with real one", "block number should match with real one")
  })

  it('checks time stamp', async () => {
    const timestamp = await timeHelpersMock.getTimestampExt()
    const timestamp64 = await timeHelpersMock.getTimestamp64Ext()
    const timestampReal = await timeHelpersMock.getTimestampDirect()

    const timestamp64Diff = timestamp64.minus(timestamp)
    const timestampRealDiff = timestampReal.minus(timestamp)
    assert.isTrue(timestamp64Diff.lessThanOrEqualTo(1), "time stamps should match (or be very close to)")
    assert.isTrue(timestampRealDiff.lessThanOrEqualTo(1), "time stamp should match with real one (or be very close to)")
  })
})
