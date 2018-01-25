const { assertRevert } = require('./helpers/assertThrow')
const { getBalance } = require('./helpers/web3')
const EtherToken = artifacts.require('EtherToken')
const ERC677Stub = artifacts.require('ERC677Stub')

contract('EtherToken', accounts => {
  let token = {}
  const value = 1000
  const from = accounts[0]
  const withdrawAddr = '0x0000000000000000000000000000000000001234'

  beforeEach(async () => {
    token = await EtherToken.new()
  })

  it('fails when wrapping 0', async () => {
    return assertRevert(async () => {
        await token.wrap({ value: 0 })
    })
  })

  it('can wrap and call', async () => {
      const stub = await ERC677Stub.new()
      const data = '0x12'

      await token.wrapAndCall(stub.address, data, { from, value })

      assert.equal(await stub.token(), token.address, 'token should be correct')
      assert.equal(await stub.from(), from, 'from should be correct')
      assert.equal(await stub.amount(), value, 'value should be correct')
      assert.equal(await stub.data(), data, 'value should be correct')

      assert.equal(await token.balanceOf(from), 0, 'from should have 0 token balance')
      assert.equal(await token.balanceOf(stub.address), value, 'receiver should have correct token balance')
  })

  context('wrapping eth', () => {
      beforeEach(async () => {
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

      it('can transfer and call', async () => {
          const stub = await ERC677Stub.new()
          const data = '0x12'

          await token.transferAndCall(stub.address, value, data, { from })

          assert.equal(await stub.token(), token.address, 'token should be correct')
          assert.equal(await stub.from(), from, 'from should be correct')
          assert.equal(await stub.amount(), value, 'value should be correct')
          assert.equal(await stub.data(), data, 'value should be correct')

          assert.equal(await token.balanceOf(from), 0, 'from should have 0 token balance')
          assert.equal(await token.balanceOf(stub.address), value, 'receiver should have correct token balance')
      })

      it('fails when withdrawing more than balance', async () => {
        return assertRevert(async () => {
            await token.withdraw(withdrawAddr, value + 1)
        })
      })

      it('fails when withdrawing 0', async () => {
        return assertRevert(async () => {
            await token.withdraw(withdrawAddr, 0)
        })
      })
  })
})
