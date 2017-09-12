const assertThrow = require('./helpers/assertThrow');
var FinanceApp = artifacts.require('../contrats/app/accounting/FinanceApp')
var EtherToken = artifacts.require('EtherToken')

const { getBalance } = require('./helpers/web3')
const { signatures, sendTransaction } = require('./helpers/web3')
const timer = require('./helpers/timer')
const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('FinanceApp', accounts => {

  let token = {}

  beforeEach(async () => {
    token = EtherToken.new()
  })

  context('installed app', () => {
    let financeApp = {}

    beforeEach(async () => {
      financeApp = await FinanceApp.new()
    })


    it('can create new transaction', async () => {
        var i = 0;
        console.log(i++);
        await financeApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        console.log(i++);
        await financeApp.next()
        console.log(i++);
        await financeApp.newIncomingTransaction('0x111', '0x100', 100, 'Ref 123')
        console.log(i++);
        let ti0 = await financeApp.getTransactionInfo.call(0)
        console.log(i++);
        assert.equal(ti0[3], 'Ref 123', 'Should have matching reference number')
        console.log(i++);
        let ts0 = await financeApp.getTransactionState(0)
        console.log(i++);
        assert.equal(ts0[0], 0, 'Should have state New (0)')
        console.log(i++);
        assert.equal(ts0[1], 'new', 'Should reason should be new')
        console.log(i++);
    })
    it('newAccounting Periods are properly spaced', async () => {
        await financeApp.setDefaultAccountingPeriodSettings('0x111', '*', '*', '*', '*', '*'); // 5  new accounting period every hour
        let t = await financeApp.next()
        let ap_id = await financeApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should be on the 1st (index 0) accounting period")
        t = await financeApp.next()
        ap_id = await financeApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should STILL be on the 1st (index 0) accounting period")
        await timer(864000) // 8640 seconds in a day
        t = await financeApp.next()
        ap_id = await financeApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 1, "Should be on the 1 index (2nd) accounting period")

    })

    it('can record transaction from incoming deposits', async () => {

        await financeApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await financeApp.next()
        await financeApp.newIncomingTransaction('0x111', '0x100', 100, 'Ref 123') 
        let l = await financeApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')

        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        l = await financeApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
    })

    it('can send transactions after approval', async () => {

        await financeApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await financeApp.startNextAccountingPeriod()
        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        let l = await financeApp.getTransactionsLength.call()
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')
        let eth_token = await vault.getEtherToken()
        await financeApp.newOutgoingTransaction(accounts[1], eth_token, 100, 'Ref 123') // 0 is TransactionType.Withdrawal
        l = await financeApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
        await financeApp.approveTransaction(1, 'this is valid')

        let ti1 = await financeApp.getTransactionInfo.call(1)

        const etherToken = EtherToken.at(eth_token)
        assert.equal(await etherToken.balanceOf(accounts[1]), 100, 'transferred ether should be inside ETH token')

    })

    it('can send actual ether from eth token withdrawl', async () => {

        await financeApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await financeApp.startNextAccountingPeriod()
        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        let l = await financeApp.getTransactionsLength.call()
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')
        let eth_token = await vault.getEtherToken()
        await financeApp.newOutgoingTransaction(randomAddress, 0, 100, 'Ref 123') // 0 is TransactionType.Withdrawal
        l = await financeApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
        await financeApp.approveTransaction(1, 'this is valid')

        let ti1 = await financeApp.getTransactionInfo.call(1)

        const etherToken = EtherToken.at(eth_token)
        assert.equal(await etherToken.balanceOf(randomAddress), 0, 'transferred ether should not be inside ETH token')

        assert.equal(await getBalance(randomAddress), 100)
    })

  })
})
