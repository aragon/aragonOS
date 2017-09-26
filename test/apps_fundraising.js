const { assertInvalidOpcode } = require('./helpers/assertThrow')

const TokenManager = artifacts.require('TokenManager')
const MiniMeToken = artifacts.require('MiniMeToken')
const FundraisingApp = artifacts.require('FundraisingAppMock')
const EtherToken = artifacts.require('EtherToken')

const zeroAddress = '0x0000000000000000000000000000000000000000'

contract('Fundraising', accounts => {
    let tokenManager, token, raisedToken, fundraising = {}

    const vault = accounts[8]
    const holder1000 = accounts[1]
    const holder10 = accounts[2]

    beforeEach(async () => {
        raisedToken = await MiniMeToken.new(zeroAddress, zeroAddress, 0, 'n', 0, 'n', true)
        await raisedToken.generateTokens(holder1000, 1000)
        await raisedToken.generateTokens(holder10, 10)

        token = await MiniMeToken.new(zeroAddress, zeroAddress, 0, 'n', 0, 'n', true)
        tokenManager = await TokenManager.new()
        await token.changeController(tokenManager.address)
        await tokenManager.initialize(token.address, zeroAddress)

        fundraising = await FundraisingApp.new()
        await fundraising.initialize(tokenManager.address, vault)
        await fundraising.mock_setTimestamp(5)
    })

    it('max raised and max sold are both hit', async () => {
        const maxRaised = 100
        const maxSold = 150

        await fundraising.newSale(zeroAddress, raisedToken.address, maxRaised, maxSold, 0, true, 1, [11], [2, 2])
        await raisedToken.approve(fundraising.address, 130, { from: holder1000 })

        await fundraising.transferAndBuy(0, 40, { from: holder1000 })
        await fundraising.transferAndBuy(0, 34, { from: holder1000 })
        await fundraising.transferAndBuy(0, 56, { from: holder1000 })

        assert.equal(await token.balanceOf(holder1000), 150, 'should have gotten max sold tokens')
        assert.equal(await raisedToken.balanceOf(holder1000), 925, 'should have non-spent tokens')

        const [closed] = await fundraising.getSale(0)
        assert.isTrue(closed, 'sale should be closed')
    })

    it('fails if buying less than min buy', async () => {
        const minBuy = 2

        await fundraising.newSale(zeroAddress, raisedToken.address, 100, 150, minBuy, true, 1, [11], [1, 1])
        await raisedToken.approve(fundraising.address, 1, { from: holder1000 })

        return assertInvalidOpcode(async () => {
            await fundraising.transferAndBuy(0, 1, { from: holder1000 })
        })
    })

    it('only allow investor to invest in private sale', async () => {
        await fundraising.newSale(holder10, raisedToken.address, 10000, 10000, 0, true, 1, [11], [2, 2])
        await raisedToken.approve(fundraising.address, 1, { from: holder1000 })
        await raisedToken.approve(fundraising.address, 1, { from: holder10 })

        await fundraising.transferAndBuy(0, 1, { from: holder10 })

        assert.equal(await token.balanceOf(holder10), 2, 'investor should have received tokens')

        return assertInvalidOpcode(async () => {
            await fundraising.transferAndBuy(0, 1, { from: holder1000 })
        })
    })

    context('ERC677 sales', () => {
        let etherToken, buyData = {}

        beforeEach(async () => {
            etherToken = await EtherToken.new()
            await fundraising.newSale(zeroAddress, etherToken.address, 10000, 10000, 0, true, 4, [10], [2, 2])

            const saleId = 0
            buyData = fundraising.contract.buyWithToken.getData(saleId)
        })

        it('buys tokens correctly', async () => {
            await etherToken.wrapAndCall(fundraising.address, buyData, { value: 100 }) // performs transferAndCall under the hood

            assert.equal(await token.balanceOf(accounts[0]), 200, 'should have received tokens')
            assert.equal(await etherToken.balanceOf(vault), 100)
        })

        it('returns tokens if cap hit', async () => {
            await etherToken.wrapAndCall(fundraising.address, buyData, { value: 15000 }) // performs transferAndCall under the hood
            // only 5000 accepted (hits maxSold), returns 10000

            assert.equal(await token.balanceOf(accounts[0]), 10000, 'should have received tokens')
            assert.equal(await etherToken.balanceOf(vault), 5000)
            assert.equal(await etherToken.balanceOf(accounts[0]), 10000)
        })

        it('fails if data is not correctly specified', async () => {
            return assertInvalidOpcode(async () => {
                await etherToken.wrapAndCall(fundraising.address, '0x00', { value: 15000 })
            })
        })

        it('fails if buying in non-existent sale', async () => {
            return assertInvalidOpcode(async () => {
                await etherToken.wrapAndCall(fundraising.address, fundraising.contract.buyWithToken.getData(100), { value: 15000 })
            })
        })
    })

    context('creating normal rate sale', () => {
        beforeEach(async () => {
            // sale with decreasing price. 1 token per 5 raised tokens first 10 seconds, 1 token per 2 raised last 10 seconds
            await fundraising.newSale(zeroAddress, raisedToken.address, 100, 30, 0, false, 11, [21, 31], [5, 5, 2, 2])
            await raisedToken.approve(fundraising.address, 1000, { from: holder1000 })
        })

        it('returns correct sale info', async () => {
            const info = await fundraising.getSale(0)

            const [closed, inv, rt, mr, ms, mb, inp, st, pc, cp] = info

            assert.equal(closed, false, 'sale should not be closed')
            assert.equal(inv, zeroAddress, 'investor should be correct')
            assert.equal(rt, raisedToken.address, 'raisedToken should be correct')
            assert.equal(mr, 100, 'max raised should be correct')
            assert.equal(ms, 30, 'max sold should be correct')
            assert.equal(mb, 0, 'min buy should be correct')
            assert.equal(st, 11, 'start time should be correct')
            assert.equal(inp, false, 'inverse price should be correct')
            assert.equal(pc, 2, 'periods count should be correct')
            assert.equal(cp, 0, 'current periods should be correct')
        })

        it('returns correct period info', async () => {
            await fundraising.mock_setTimestamp(35)

            const [start1, end1, initial1, final1] = await fundraising.getPeriod(0, 0)
            const [start2, end2, initial2, final2] = await fundraising.getPeriod(0, 1)

            assert.equal(start1, 11, 'start time should be correct')
            assert.equal(end1, 21, 'end time should be correct')
            assert.equal(initial1, 5, 'price should be correct')
            assert.equal(final1, 5, 'price should be correct')

            assert.equal(start2, 21, 'start time should be correct')
            assert.equal(end2, 31, 'end time should be correct')
            assert.equal(initial2, 2, 'price should be correct')
            assert.equal(final2, 2, 'price should be correct')
        })

        it('fails if buying before sale starts', async () => {
            await fundraising.mock_setTimestamp(10)
            return assertInvalidOpcode(async () => {
                await fundraising.transferAndBuy(0, 30, { from: holder1000 })
            })
        })

        it('can only buy up-to max raised', async () => {
            await fundraising.mock_setTimestamp(11)

            await fundraising.transferAndBuy(0, 110, { from: holder1000 })

            assert.equal(await raisedToken.balanceOf(vault), 100, 'should have only received max raised')
            assert.equal(await raisedToken.balanceOf(holder1000), 900, 'should have only debited max raised')

            assert.equal(await token.balanceOf(holder1000), 20, 'should received tokens')
            const [closed] = await fundraising.getSale(0)
            assert.isTrue(closed, 'sale should be closed')
        })

        it('can only buy up-to max sold', async () => {
            await fundraising.mock_setTimestamp(22)

            await fundraising.transferAndBuy(0, 90, { from: holder1000 })

            assert.equal(await raisedToken.balanceOf(vault), 60, 'should have only received max raised')
            assert.equal(await raisedToken.balanceOf(holder1000), 940, 'should have only debited max raised')

            assert.equal(await token.balanceOf(holder1000), 30, 'should received tokens')
            const [closed] = await fundraising.getSale(0)
            assert.isTrue(closed, 'sale should be closed')
        })

        it('can force closing sale if authorized', async () => {
            await fundraising.forceCloseSale(0)
            const [closed] = await fundraising.getSale(0)
            assert.isTrue(closed, 'sale should be closed')
        })

        it('can close sale after all periods ended', async () => {
            await fundraising.mock_setTimestamp(32)
            await fundraising.closeSale(0)

            const [closed] = await fundraising.getSale(0)
            assert.isTrue(closed, 'sale should be closed')
        })

        it('fails when closing ongoing sale', async () => {
            await fundraising.mock_setTimestamp(21)
            return assertInvalidOpcode(async () => {
                await fundraising.closeSale(0)
            })
        })
    })
})
