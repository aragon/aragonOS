const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var AccountingApp = artifacts.require('../contrats/app/accounting/AccountingApp')
var VaultOrgan = artifacts.require('VaultOrgan')
var MockedApp = artifacts.require('./mocks/MockedApp')
var Application = artifacts.require('Application')
var Kernel = artifacts.require('Kernel')
var EtherToken = artifacts.require('EtherToken')

const { getBalance } = require('./helpers/web3')
const createDAO = () => DAO.new(Kernel.address)
const { installOrgans  } = require('./helpers/installer')
const { signatures, sendTransaction } = require('./helpers/web3')
const timer = require('./helpers/timer')
const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('AccountingApp', accounts => {
  let dao, metadao, kernel, vault = {}

  let randomAddress = 0
  let token = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    await installOrgans(metadao, [MetaOrgan, VaultOrgan])
    kernel = Kernel.at(dao.address)
    vault = VaultOrgan.at(dao.address)
    await vault.setupEtherToken()
    token = EtherToken.at(await vault.getEtherToken())
  })

  context('installed app', () => {
    let accountingApp = {}
    let dao_accountingApp = {}

    beforeEach(async () => {
      accountingApp = await AccountingApp.new(dao.address)
      dao_accountingApp = AccountingApp.at(dao.address)
      await metadao.installApp(accountingApp.address, signatures(AccountingApp, [Application], web3))
    })

    it('returns installed app address', async () => {
      const [addr, delegate] = await kernel.get(signatures(AccountingApp, [Application], web3)[0])
      assert.equal(addr, accountingApp.address, 'should have returned installed app addr')
      assert.isFalse(delegate, 'Call to application shouldnt be delegate')
    })

    it('can create new transaction', async () => {
        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await dao_accountingApp.startNextAccountingPeriod()
        await dao_accountingApp.newTransaction('0x111', '0x100', 100, 'Ref 123', 0) // 0 is TransactionState.New
        let ti0 = await dao_accountingApp.getTransactionInfo.call(0)
        assert.equal(ti0[3], 'Ref 123', 'Should have matching reference number')
        let ts0 = await dao_accountingApp.getTransactionState(0)
        assert.equal(ts0[0], 0, 'Should have state New (0)')
        assert.equal(ts0[1], 'new', 'Should reason should be new')
    })

    it('can update transaction', async () => {
        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); //  new accounting period every sunday at midnight
        await dao_accountingApp.startNextAccountingPeriod()
        await dao_accountingApp.newTransaction('0x111', '0x100', 100, 'Ref 123', 0) // 0 is TransactionState.New
        await dao_accountingApp.updateTransaction(0, 1, 'needs approval')
        let ti0 = await dao_accountingApp.getTransactionInfo.call(0)
        assert.equal(ti0[3], 'Ref 123', 'Should have matching reference number')
        let ts0 = await dao_accountingApp.getTransactionState(0)
        assert.equal(ts0[0], 1, 'Should have state PendingApproval (1)')
        assert.equal(ts0[1], 'needs approval', 'should have a "reason" of "need approval"')
    })

    it('can throttle newAccounting Periods', async () => {
        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '*', '*', '*', '*', '*'); // 5  new accounting period every hour
        let t = await dao_accountingApp.startNextAccountingPeriod()
        let ap_id = await dao_accountingApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should be on the 1st (index 0) accounting period")
        t = await dao_accountingApp.startNextAccountingPeriod()
        ap_id = await dao_accountingApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should STILL be on the 1st (index 0) accounting period")
        await timer(864000) // 8640 seconds in a day
        t = await dao_accountingApp.startNextAccountingPeriod()
        ap_id = await dao_accountingApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 1, "Should be on the 1 index (2nd) accounting period")

    })

    it('can record transaction from incoming deposits', async () => {

        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await dao_accountingApp.startNextAccountingPeriod()
        await dao_accountingApp.newTransaction( '0x111', '0x100', 100, 'Ref 123', 0) // 0 is TransactionType.Deposit
        let l = await dao_accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')

        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        l = await dao_accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')
    })


    it('can send transactions after approval', async () => {

        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); // new accounting period every sunday at midnight
        await dao_accountingApp.startNextAccountingPeriod()
        await sendTransaction({value: 100, from: accounts[0], to: dao.address, gas: 4e6 });
        let l = await dao_accountingApp.getTransactionsLength.call()
        assert.equal(l.toNumber(), 1, 'Should have 1 transaction')
        let eth_token = await vault.getEtherToken()
        console.log(eth_token)
        await dao_accountingApp.newTransaction(accounts[1], eth_token, 100, 'Ref 123', 1) // 0 is TransactionType.Withdrawal
        l = await dao_accountingApp.getTransactionsLength.call();
        assert.equal(l.toNumber(), 2, 'Should have 2 transactions')

        await dao_accountingApp.updateTransaction(1, 1, 'needs approval')
        // await dao_accountingApp.approveTransaction(1, 'this is valid')
        let ti1 = await dao_accountingApp.getTransactionInfo.call(1)

    })

  })
})
