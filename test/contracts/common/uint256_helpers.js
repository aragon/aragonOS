const { assertRevert } = require('../../helpers/assertThrow')

contract('Uint256 Helpers test', () => {
  let uint256Mock

  before(async () => {
    uint256Mock = await artifacts.require('Uint256Mock').new()
  })

  it('converts from uint256 to uint64', async () => {
    const a = 1234
    assert.equal((await uint256Mock.convert(a)).toString(), a, 'values should match')
  })

  it('fails converting from uint256 to uint64 if too big', async () => {
    const a = new web3.BigNumber(2).pow(64)
    await assertRevert(uint256Mock.convert(a))
  })
})
