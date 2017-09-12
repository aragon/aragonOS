const assertThrow = require('./helpers/assertThrow');
var FinanceApp = artifacts.require('../contrats/app/accounting/FinanceApp')
var Vault = artifacts.require('../contrats/apps/vault/Vault')
const { getBalance } = require('./helpers/web3')
const { signatures, sendTransaction } = require('./helpers/web3')
const timer = require('./helpers/timer')
const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('FinanceApp', accounts => {

  let token = {}

  beforeEach(async () => {
  })

  context('installed app', () => {
    let financeApp = {}
    let vault = {}

    beforeEach(async () => {
      financeApp = await FinanceApp.new()
      vault = await Vault.new()
      await financeApp.initialize(vault.address)
    })


    it('newAccounting Periods are properly spaced', async () => {
        await financeApp.setDefaultAccountingPeriodSettings('0', '0', '*', '*', '*', '*', '*');  
        let t = await financeApp.startNextAccountingPeriod()
        let ap_id = await financeApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should be on the 1st (index 0) accounting period")
        t = await financeApp.startNextAccountingPeriod()
        ap_id = await financeApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 0, "Should STILL be on the 1st (index 0) accounting period")
        await timer(864000) // 8640 seconds in a day
        t = await financeApp.startNextAccountingPeriod()
        ap_id = await financeApp.getCurrentAccountingPeriodId()
        assert.equal(ap_id, 1, "Should be on the 1 index (2nd) accounting period")

    })

  })
})
