const { assertInvalidOpcode } = require('./helpers/assertThrow')
const { getBlockNumber } = require('./helpers/web3')

const Vault = artifacts.require('Vault')
const FinanceApp = artifacts.require('FinanceAppMock')
const MiniMeToken = artifacts.require('MiniMeToken')

contract('Finance App', accounts => {
    let app, vault, token1, token2, executionTarget = {}

    const n = '0x00'
    const periodDuration = 20

    beforeEach(async () => {
        vault = await Vault.new()

        token1 = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)
        await token1.generateTokens(vault.address, 100)

        token2 = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)
        await token2.generateTokens(vault.address, 200)

        app = await FinanceApp.new()
        await app.mock_setTimestamp(1)

        await app.initialize(vault.address, periodDuration)
    })

    it('initialized first accounting period and settings', async () => {
        const [duration, budgets] = await app.getSettings()

        assert.equal(periodDuration, duration, 'period duration should match')
        assert.equal(await app.currentPeriodId(), 0, 'current period should be 0')
    })

    it('adds new token to budget', async () => {
        await app.setBudget(token1.address, 10)

        const [tokenAddress, budget, remainingBudget] = await app.getBudget(0)
        assert.equal(tokenAddress, token1.address, 'should have correct token address')
        assert.equal(budget, 10, 'should have correct budget')
        assert.equal(remainingBudget, 10, 'all budget is remaining')

        assert.equal(await token1.allowance(vault.address, app.address), 10, 'should have made budget allowance')
    })

    context('configured app', () => {
        const recipient = accounts[1]
        const time = 22

        beforeEach(async () => {
            await app.setBudget(token1.address, 50)
            await app.setBudget(token2.address, 100)

            await app.mock_setTimestamp(time)
        })

        it('can create single payment', async () => {
            const amount = 10

            await app.newPayment(token1.address, recipient, amount, time, 0, 1, '')

            assert.equal(await token1.balanceOf(recipient), amount, 'recipient should have received tokens')
            assert.deepEqual(await app.nextPaymentTime(1), await app.MAX_UINT64(), 'payment should never be repeated')
        })
    })
})
