const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var AccountingApp = artifacts.require('../contrats/app/accounting/AccountingApp')
var MockedApp = artifacts.require('./mocks/MockedApp')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('AccountingApp', accounts => {
  let dao, metadao, kernel, appOrgan = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const apps = await ApplicationOrgan.new()
    await metadao.installOrgan(apps.address, 3)
    appOrgan = ApplicationOrgan.at(dao.address)
  })

  context('installed app', () => {
    let accountingApp = {}
    let dao_accountingApp = {}

    beforeEach(async () => {
      accountingApp = await AccountingApp.new(dao.address)
      dao_accountingApp = AccountingApp.at(dao.address)
      await appOrgan.installApp(1, accountingApp.address)
    })

    it('returns installed app address', async () => {
      assert.equal(await appOrgan.getApp(1), accountingApp.address, 'should have returned installed app addr')
    })

    it('can create new transaction', async () => {
        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0')
        await dao_accountingApp.startNextAccountingPeriod()
        await dao_accountingApp.newTransaction('0x111', '0x100', 100, 'Ref 123')
        let ti0 = await dao_accountingApp.getTransactionInfo.call(0)
        let ts0 = await dao_accountingApp.getTransactionState(0)
        console.log(ti0)
        console.log(ts0)
        // (t.externalAddress, t.token, t.amount, t.reference);
        assert.equal(ti0[3], 'Ref 123', 'Should have matching reference number')
        assert.equal(ts0, 'Ref 123', 'Should have matching reference number')
    })

    it('can update transaction', async () => {
        await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0'); // 5  new accounting period every sunday at midnight
        await dao_accountingApp.startNextAccountingPeriod()
        await dao_accountingApp.newTransaction( '0x111', '0x100', 100, 'Ref 123')
        await dao_accountingApp.updateTransaction(0, 1, 'needs approval')
        let t0 = await dao_accountingApp.getTransactionState(0)
        assert.equal(t0[3], 'Ref 123', 'Should have matching reference number')
    })

    it('can create new accounting periods', async () => {
        ///await dao_accountingApp.setDefaultAccountingPeriodSettings('0x111', '0', '*', '*', '0'); // 5  new accounting period every sunday at midnight
        //await dao_accountingApp.startNextAccountingPeriod()
        //await dao_accountingApp.newTransaction( '0x111', 100, '0x100', 'Ref 123', 0)
        //let t0 = await dao_accountingApp.getTransactionState(0)
        //assert.equal(t0[5], 0, 'Should be in the 0th accountingPeriod')

        //await dao_accountingApp.startNextAccountingPeriod()
        //await dao_accountingApp.newTransaction( '0x111', 100, '0x100', 'Ref 345', 0)
        //let t1 = await dao_accountingApp.getTransactionState(1)
        //assert.equal(t1[2], 'Ref 345', 'Should have matching reference number')
        //assert.equal(t1[5], 1, 'Should be in the 1st accountingPeriod')
    })
  })

})
