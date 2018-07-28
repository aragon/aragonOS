const { assertRevert } = require('./helpers/assertThrow')

contract('Uint64 Helpers test', accounts => {
  let uint64Mock

  before(async () => {
    uint64Mock = await artifacts.require('Uint64Mock').new()
  })

  it('converts from uint256 to uint64', async () => {
    const a = 1234
    assert.equal((await uint64Mock.convert.call(a)).toString(), a, "Values should match")
  })

  it('fails converting from uint256 to uint64 if too big', async () => {
    const a = new web3.BigNumber(2).pow(64)
    return assertRevert(async () => {
      assert.equal((await uint64Mock.convert(a)).toString(), a, "Values should match")
    })
  })
})
