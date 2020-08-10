const { bn } = require('@aragon/contract-helpers-test')
const { assertRevert } = require('@aragon/contract-helpers-test/src/asserts')

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
    const a = bn(2).pow(bn(64))
    await assertRevert(uint256Mock.convert(a))
  })
})
