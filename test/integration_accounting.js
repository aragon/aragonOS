const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var AccountingApp = artifacts.require('../contrats/app/accounting/AccountingApp')
var VaultOrgan = artifacts.require('VaultOrgan')
var MockedApp = artifacts.require('./mocks/MockedApp')
var Application = artifacts.require('Application')
var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new(Kernel.address)
const { installOrgans  } = require('./helpers/installer')
const { signatures } = require('./helpers/web3')

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('AccountingApp', accounts => {
  let dao, metadao, kernel = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    await installOrgans(metadao, [MetaOrgan])
    kernel = Kernel.at(dao.address)
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
        await dao_accountingApp.newTransaction('0x111', '0x100', 100, 'Ref 123')
        let ti0 = await dao_accountingApp.getTransactionInfo.call(0)
        assert.equal(ti0[3], 'Ref 123', 'Should have matching reference number')
        let ts0 = await dao_accountingApp.getTransactionState(0)
        assert.equal(ts0[0], 0, 'Should have state New (0)')
        assert.equal(ts0[1], 'new', 'Should reason should be new')
    })

    it('can update transaction', async () => {
        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0', '*'); //  new accounting period every sunday at midnight
        await dao_accountingApp.startNextAccountingPeriod()
        await dao_accountingApp.newTransaction( '0x111', '0x100', 100, 'Ref 123')
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
        web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [86400],  // 86400 seconds in a day
            id: new Date().getTime()
        }, async (error, result) => {
            console.log(x)
            t = await dao_accountingApp.startNextAccountingPeriod()
            ap_id = await dao_accountingApp.getCurrentAccountingPeriodId()
            assert.equal(ap_id, 1, "Should be on the 1 index (2nd) accounting period")
        })
    })
  })
})
