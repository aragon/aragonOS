const { bn } = require('@aragon/contract-helpers-test')

contract('TimeHelpers', () => {
  let timeHelpersMock

  before(async () => {
    timeHelpersMock = await artifacts.require('TimeHelpersMock').new()
  })

  it('checks block number', async () => {
    assert.equal((await timeHelpersMock.getBlockNumberExt()).toString(), (await timeHelpersMock.getBlockNumber64Ext()).toString(), "block numbers should match")
    assert.equal((await timeHelpersMock.getBlockNumberExt()).toString(), (await timeHelpersMock.getBlockNumberDirect()).toString(), "block number should match with real one")
  })

  it('checks time stamp', async () => {
    const timestamp = await timeHelpersMock.getTimestampExt()
    const timestamp64 = await timeHelpersMock.getTimestamp64Ext()
    const timestampReal = await timeHelpersMock.getTimestampDirect()

    const timestamp64Diff = timestamp64.sub(timestamp)
    assert.isTrue(timestamp64Diff.lte(bn(1)), 'time stamps should match (or be very close to)')

    const timestampRealDiff = timestampReal.sub(timestamp)
    assert.isTrue(timestampRealDiff.lte(bn(1)), 'time stamp should match with real one (or be very close to)')
  })
})
