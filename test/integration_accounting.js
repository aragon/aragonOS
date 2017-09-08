const assertThrow = require('./helpers/assertThrow');
var AccountingApp = artifacts.require('../contrats/app/accounting/AccountingApp')
var EtherToken = artifacts.require('EtherToken')

const { getBalance } = require('./helpers/web3')
const { signatures, sendTransaction } = require('./helpers/web3')
const timer = require('./helpers/timer')
const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('AccountingApp', accounts => {

  let token = {}

  beforeEach(async () => {
    token = EtherToken.new()
  })

  context('installed app', () => {
    let accountingApp = {}

    beforeEach(async () => {
      accountingApp = await AccountingApp.new()
    })


    it('can create new transaction', async () => {
        var i = 0;
        console.log(i++);
        await accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        console.log(i++);
        await accountingApp.startNextAccountingPeriod()
        console.log(i++);
        await accountingApp.newIncomingTransaction('0x111', '0x100', 100, 'Ref 123')
        console.log(i++);
        let ti0 = await accountingApp.getTransactionInfo.call(0)
        console.log(i++);
        assert.equal(ti0[3], 'Ref 123', 'Should have matching reference number')
        console.log(i++);
        let ts0 = await accountingApp.getTransactionState(0)
        console.log(i++);
        assert.equal(ts0[0], 0, 'Should have state New (0)')
        console.log(i++);
        assert.equal(ts0[1], 'new', 'Should reason should be new')
        console.log(i++);
    })
    it('can throttle newAccounting Periods', async () => {
        await accountingApp.setDefaultAccountingPeriodSettings('0x111', '*', '*', '*', '*', '*'); // 5  new accounting period every hour
        let t = await accountingApp.startNextAccountingPeriod()
        let ap_id = await accountingApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should be on the 1st (index 0) accounting period")
        t = await accountingApp.startNextAccountingPeriod()
        ap_id = await accountingApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should STILL be on the 1st (index 0) accounting period")
        await timer(864000) // 8640 seconds in a day
        t = await accountingApp.startNextAccountingPeriod()
        ap_id = await accountingApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 1, "Should be on the 1 index (2nd) accounting period")

    })

    it('can record transaction from incoming deposits', async () => {

        await accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await accountingApp.startNextAccountingPeriod()
        await accountingApp.newIncomingTransaction('0x111', '0x100', 100, 'Ref 123') 
        let l = await accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')

        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        l = await accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
    })

    it('can send transactions after approval', async () => {

        await accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await accountingApp.startNextAccountingPeriod()
        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        let l = await accountingApp.getTransactionsLength.call()
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')
        let eth_token = await vault.getEtherToken()
        await accountingApp.newOutgoingTransaction(accounts[1], eth_token, 100, 'Ref 123') // 0 is TransactionType.Withdrawal
        l = await accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
        await accountingApp.approveTransaction(1, 'this is valid')

        let ti1 = await accountingApp.getTransactionInfo.call(1)

        const etherToken = EtherToken.at(eth_token)
        assert.equal(await etherToken.balanceOf(accounts[1]), 100, 'transferred ether should be inside ETH token')

    })

    it('can send actual ether from eth token withdrawl', async () => {

        await accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await accountingApp.startNextAccountingPeriod()
        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        let l = await accountingApp.getTransactionsLength.call()
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')
        let eth_token = await vault.getEtherToken()
        await accountingApp.newOutgoingTransaction(randomAddress, 0, 100, 'Ref 123') // 0 is TransactionType.Withdrawal
        l = await accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
        await accountingApp.approveTransaction(1, 'this is valid')

        let ti1 = await accountingApp.getTransactionInfo.call(1)

        const etherToken = EtherToken.at(eth_token)
        assert.equal(await etherToken.balanceOf(randomAddress), 0, 'transferred ether should not be inside ETH token')

        assert.equal(await getBalance(randomAddress), 100)
    })

  })
})
