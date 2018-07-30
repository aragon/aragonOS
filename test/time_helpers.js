contract('TimeHelpers test', accounts => {
  let timeHelpersMock

  before(async () => {
    timeHelpersMock = await artifacts.require('TimeHelpersMock').new()
  })

  it('checks block number', async () => {
    assert.equal((await timeHelpersMock.getBlockNumberExt.call()).toString(), (await timeHelpersMock.getBlockNumber64Ext.call()).toString(), "block number should match")
  })

  it('checks time stamp', async () => {
    assert.equal((await timeHelpersMock.getTimestampExt.call()).toString(), (await timeHelpersMock.getTimestamp64Ext.call()).toString(), "time stamp should match")
  })
})
