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
    assert.equal((await timeHelpersMock.getTimestampExt.call()).toString(), (await timeHelpersMock.getTimestamp64Ext.call()).toString(), "time stamps should match")
    assert.equal((await timeHelpersMock.getTimestampExt.call()).toString(), (await timeHelpersMock.getTimestampDirect.call()).toString(), "time stamp should match with real one")
  })
})
