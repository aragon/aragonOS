const { assertInvalidOpcode } = require('./helpers/assertThrow')
const timetravel = require('./helpers/timer')

const TokenManager = artifacts.require('TokenManager')
const MiniMeToken = artifacts.require('MiniMeToken')

const n = '0x00'

contract('Token Manager', accounts => {
    let tokenManager, token = {}

    beforeEach(async () => {
        token = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)
        tokenManager = await TokenManager.new()
        await token.changeController(tokenManager.address)
    })

    context('for wrapped tokens', () => {
        let wrappedToken = {}

        const holder100 = accounts[1]

        beforeEach(async () => {
            wrappedToken = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)
            await wrappedToken.generateTokens(holder100, 100)

            await tokenManager.initialize(token.address, wrappedToken.address)
        })

        it('cannot wrap more than allowance', async () => {
            await wrappedToken.approve(tokenManager.address, 99, { from: holder100 })
            return assertInvalidOpcode(async () => {
                await tokenManager.wrap(100, { from: holder100 })
            })
        })

        it('cannot mint', async () => {
            return assertInvalidOpcode(async () => {
                await tokenManager.mint(holder100, 100)
            })
        })

        it('cannot issue', async () => {
            return assertInvalidOpcode(async () => {
                await tokenManager.issue(100)
            })
        })

        context('wrapping tokens', () => {
            beforeEach(async () => {
                await wrappedToken.approve(tokenManager.address, 100, { from: holder100 })
                await tokenManager.wrap(100, { from: holder100 })
            })

            it('balances are correct', async () => {
                assert.equal(await token.balanceOf(holder100), 100, 'tokens should have been wrapped 1:1')
                assert.equal(await wrappedToken.balanceOf(holder100), 0, 'balance should be 0 on wrapped token')
                assert.equal(await wrappedToken.balanceOf(tokenManager.address), 100, 'tokenManager should hold wrapped tokens')
            })

            it('can unwrap', async () => {
                await tokenManager.unwrap(50, { from: holder100 }) // unwrap half of wrapped tokens

                assert.equal(await token.balanceOf(holder100), 50, 'tokens should have been unwrapped 1:1')
                assert.equal(await wrappedToken.balanceOf(holder100), 50, 'balance should be 50 on wrapped token')
                assert.equal(await wrappedToken.balanceOf(tokenManager.address), 50, 'tokenManager should hold wrapped tokens')
            })

            it('can transfer', async () => {
                await token.transfer(accounts[2], 10, { from: holder100 })

                assert.equal(await token.balanceOf(holder100), 90, 'balance should be correct')
                assert.equal(await token.balanceOf(accounts[2]), 10, 'balance should be correct')
            })

            it('cannot unwrap tokens with vesting', async () => {
                await token.transfer(tokenManager.address, 100, { from: holder100 })
                await tokenManager.assignVested(holder100, 100, 1e14, 1e14, 1e14, false)

                return assertInvalidOpcode(async () => {
                    await tokenManager.unwrap(100, { from: holder100 })
                })
            })
        })
    })
})
