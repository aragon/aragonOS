const assertThrow = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')
var EtherToken = artifacts.require('EtherToken')

// TODO: Add zeppelin standard token tests

contract('EtherToken', accounts => {
  let token = {}
  let randomAddress = 0
  const value = 1000
  const from = accounts[0]

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

    const prevBalance = await getBalance('0x0000000000000000000000000000000000001234')
    await token.withdraw(withdrawAmount, '0x0000000000000000000000000000000000001234')
    const postBalance = await getBalance('0x0000000000000000000000000000000000001234')

    assert.equal(postBalance.minus(prevBalance), withdrawAmount, 'Should have gotten ETH in receipient address')
    assert.equal(await getBalance(token.address), value - withdrawAmount, 'Remaining ETH should be held inside token contract after withdraw')
    assert.equal(await token.balanceOf(from), value - withdrawAmount, 'Sender should have correct token balance after withdraw')
  })

  it('unwraps ETH securely', async () => {
    const withdrawAmount = 300

    const prevBalance = await getBalance('0x0000000000000000000000000000000000001234')
    await token.secureWithdraw(withdrawAmount, '0x0000000000000000000000000000000000001234')
    const postBalance = await getBalance('0x0000000000000000000000000000000000001234')

    assert.equal(postBalance.minus(prevBalance), withdrawAmount, 'Should have gotten ETH in receipient address')
    assert.equal(await getBalance(token.address), value - withdrawAmount, 'Remaining ETH should be held inside token contract after withdraw')
    assert.equal(await token.balanceOf(from), value - withdrawAmount, 'Sender should have correct token balance after withdraw')
  })

  it('throws when withdrawing more than balance', async () => {
    try {
      await token.withdraw(value + 1, randomAddress)
    } catch (error) {
      return assertThrow(error)
    }
    assert.fail('should have thrown before')
  })
})
