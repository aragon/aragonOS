const { assertInvalidOpcode } = require('./helpers/assertThrow')

const TokenManager = artifacts.require('TokenManager')
const MiniMeToken = artifacts.require('MiniMeToken')
const FundraisingApp = artifacts.require('FundraisingAppMock')

const n = '0x00'

contract('Fundraising', accounts => {
    let tokenManager, token, raisedToken, fundraising = {}

    const vault = accounts[8]
    const holder1000 = accounts[1]

    beforeEach(async () => {
        raisedToken = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)
        await raisedToken.generateTokens(holder1000, 1000)

        token = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)
        tokenManager = await TokenManager.new()
        await token.changeController(tokenManager.address)
        await tokenManager.initialize(token.address, n)

        fundraising = await FundraisingApp.new()
        await fundraising.initialize(tokenManager.address, vault)
        await fundraising.mock_setTimestamp(5)
    })

    it('max raised and max sold are both hit', async () => {
        const maxRaised = 100
        const maxSold = 150

        await fundraising.newSale(n, raisedToken.address, maxRaised, maxSold, 0, true, 1, [11], [2, 2])
        await raisedToken.approve(fundraising.address, 130, { from: holder1000 })
        await fundraising.buy(0, 130, { from: holder1000 })

        assert.equal(await token.balanceOf(holder1000), 150, 'should have gotten max sold tokens')
        assert.equal(await raisedToken.balanceOf(holder1000), 925, 'should have non-spent tokens')
    })

    it('fails if buying less than min buy', async () => {
        const minBuy = 2

        await fundraising.newSale(n, raisedToken.address, 100, 150, minBuy, true, 1, [11], [1, 1])
        await raisedToken.approve(fundraising.address, 1, { from: holder1000 })

        return assertInvalidOpcode(async () => {
            await fundraising.buy(0, 1, { from: holder1000 })
        })
    })

    context('creating normal rate sale', async () => {
        beforeEach(async () => {
            // sale with decreasing price. 1 token per 5 raised tokens first 10 seconds, 1 token per 2 raised last 10 seconds
            await fundraising.newSale(n, raisedToken.address, 100, 30, 0, false, 11, [21, 31], [5, 5, 2, 2])
            await raisedToken.approve(fundraising.address, 1000, { from: holder1000 })
        })

        it('fails if buying before sale starts', async () => {
            await fundraising.mock_setTimestamp(10)
            return assertInvalidOpcode(async () => {
                await fundraising.buy(0, 30, { from: holder1000 })
            })
        })

        it('can only buy up-to max raised', async () => {
            await fundraising.mock_setTimestamp(11)

            await fundraising.buy(0, 110, { from: holder1000 })

            assert.equal(await raisedToken.balanceOf(vault), 100, 'should have only received max raised')
            assert.equal(await raisedToken.balanceOf(holder1000), 900, 'should have only debited max raised')

            assert.equal(await token.balanceOf(holder1000), 20, 'should received tokens')
        })

        it('can only buy up-to max sold', async () => {
            await fundraising.mock_setTimestamp(22)

            await fundraising.buy(0, 90, { from: holder1000 })

            assert.equal(await raisedToken.balanceOf(vault), 60, 'should have only received max raised')
            assert.equal(await raisedToken.balanceOf(holder1000), 940, 'should have only debited max raised')

            assert.equal(await token.balanceOf(holder1000), 30, 'should received tokens')
        })

        it('can force closing sale if authorized', async () => {
            await fundraising.forceCloseSale(0)
        })
    })
})
