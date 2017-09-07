const { assertInvalidOpcode } = require('./helpers/assertThrow')
const timetravel = require('./helpers/timer')
const { getBlock, getBlockNumber } = require('./helpers/web3')

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

    context('for native tokens', () => {
        const holder = accounts[1]

        beforeEach(async () => {
            await tokenManager.initialize(token.address, n)
        })

        it('can mint tokens', async () => {
            await tokenManager.mint(holder, 100)

            assert.equal(await token.balanceOf(holder), 100, 'should have minted tokens')
        })

        it('can issue tokens', async () => {
            await tokenManager.issue(50)

            assert.equal(await token.balanceOf(tokenManager.address), 50, 'token manager should have issued tokens')
        })

        it('can assign issued tokens', async () => {
            await tokenManager.issue(50)
            await tokenManager.assign(holder, 50)

            assert.equal(await token.balanceOf(holder), 50, 'holder should have assigned tokens')
            assert.equal(await token.balanceOf(tokenManager.address), 0, 'token manager should have 0 tokens')
        })

        it('cannot wrap tokens', async () => {
            return assertInvalidOpcode(async () => {
                await tokenManager.wrap(100, { from: holder })
            })
        })

        context('assigning vested tokens', () => {
            let now = 0

            const start = 1000
            const cliff = 2000
            const vesting = 5000

            const totalTokens = 40

            beforeEach(async () => {
                await tokenManager.issue(totalTokens)
                const block = await getBlock(await getBlockNumber())
                now = block.timestamp

                await tokenManager.assignVested(holder, totalTokens, now + start, now + cliff, now + vesting, true)
            })

            it('can start transfering on cliff', async () => {
                await timetravel(cliff)
                await token.transfer(accounts[2], 10, { from: holder })
                assert.equal(await token.balanceOf(accounts[2]), 10, 'should have received tokens')
                assert.equal(await tokenManager.spendableBalanceOf(holder), 0, 'should not be able to spend more tokens')
            })

            it('can transfer all tokens after vesting', async () => {
                await timetravel(vesting)
                await token.transfer(accounts[2], totalTokens, { from: holder })
                assert.equal(await token.balanceOf(accounts[2]), totalTokens, 'should have received tokens')
            })

            it('can transfer half mid vesting', async () => {
                await timetravel(3000)

                await token.transfer(accounts[2], 20, { from: holder })

                assert.equal(await tokenManager.spendableBalanceOf(holder), 0, 'should not be able to spend more tokens')
            })

            it('cannot transfer non-vested tokens', async () => {
                return assertInvalidOpcode(async () => {
                    await token.transfer(accounts[2], 10, { from: holder })
                })
            })

            it('cannot transfer all tokens right before vesting', async () => {
                await timetravel(vesting - 10)
                return assertInvalidOpcode(async () => {
                    await token.transfer(accounts[2], totalTokens, { from: holder })
                })
            })

            it('can be revoked and not vested tokens are transfered to token manager', async () => {
                await timetravel(cliff)
                await tokenManager.revokeVesting(holder, 0)

                await token.transfer(accounts[2], 5, { from: holder })

                assert.equal(await token.balanceOf(holder), 5, 'should have kept vested tokens')
                assert.equal(await token.balanceOf(accounts[2]), 5, 'should have kept vested tokens')
                assert.equal(await token.balanceOf(tokenManager.address), totalTokens - 10, 'should have received unvested')
            })

            it('cannot revoke non-revokable vestings', async () => {
                await tokenManager.issue(1)
                await tokenManager.assignVested(holder, 1, now + start, now + cliff, now + vesting, false)

                return assertInvalidOpcode(async () => {
                    await tokenManager.revokeVesting(holder, 1)
                })
            })
        })
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
                await tokenManager.assignVested(holder100, 100, 1e11, 1e11, 1e11, false)

                return assertInvalidOpcode(async () => {
                    await tokenManager.unwrap(100, { from: holder100 })
                })
            })
        })
    })
})
