const { assertInvalidOpcode } = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')
const EtherToken = artifacts.require('EtherToken')

contract('EtherToken', accounts => {
  let token = {}
  const value = 1000
  const from = accounts[0]
  const withdrawAddr = '0x0000000000000000000000000000000000001234'

  beforeEach(async () => {
    token = await EtherToken.new()
    await token.wrap({ value, from })
  })

  it('wraps ETH into token adding balance to sender', async () => {
    assert.equal(await getBalance(token.address), value, 'ETH should be held inside token contract')
    assert.equal(await token.balanceOf(from), value, 'Sender should have correct token balance')
  })

  it('unwraps ETH burning tokens and sending ETH', async () => {
    const withdrawAmount = 300

    const prevBalance = await getBalance(withdrawAddr)
    await token.withdraw(withdrawAddr, withdrawAmount)
    const postBalance = await getBalance(withdrawAddr)

    assert.equal(postBalance.minus(prevBalance), withdrawAmount, 'Should have gotten ETH in receipient address')
    assert.equal(await getBalance(token.address), value - withdrawAmount, 'Remaining ETH should be held inside token contract after withdraw')
    assert.equal(await token.balanceOf(from), value - withdrawAmount, 'Sender should have correct token balance after withdraw')
  })

  it('unwraps entire amount to sender', async () => {
      await token.unwrap()
      assert.equal(await getBalance(token.address), 0, 'token should have 0 eth')
      assert.equal(await token.balanceOf(from), 0, 'token balance should be 0')
  })

  it('throws when withdrawing more than balance', async () => {
    return assertInvalidOpcode(async () => {
        await token.withdraw(withdrawAddr, value + 1)
    })
  })
})
