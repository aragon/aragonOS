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
        await token1.generateTokens(accounts[0], 10)

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

    it('records deposits', async () => {
        await token1.approve(app.address, 5)
        await app.deposit(token1.address, 5)

        const [periodId, amount, paymentId, token, entity, incoming] = await app.transactions(0)

        assert.equal(periodId, 0, 'period id should be correct')
        assert.equal(amount, 5, 'amount should be correct')
        assert.equal(paymentId, 0, 'payment id should be 0')
        assert.equal(token, token1.address, 'token should be correct')
        assert.equal(entity, accounts[0], 'entity should be correct')
        assert.isTrue(incoming, 'tx should be incoming')
    })

    context('setting budget', () => {
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

        it('can create recurring payments', async () => {
            const amount = 10

            await app.newPayment(token1.address, recipient, amount, time, 2, 10, '')
            await app.mock_setTimestamp(time + 4)
            await app.executePayment(1)

            assert.equal(await token1.balanceOf(recipient), amount * 3, 'recipient should have received tokens')
            assert.equal(await app.nextPaymentTime(1), time + 4 + 2, 'payment should be repeated again in 2')
        })
    })
})
