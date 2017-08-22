const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var Kernel = artifacts.require('Kernel')
var VaultOrgan = artifacts.require('VaultOrgan')
var EtherToken = artifacts.require('EtherToken')
var DAOMsgOrgan = artifacts.require('DAOMsgOrgan')
var DAOMsgApp = artifacts.require('DAOMsgApp')
var StandardTokenPlus = artifacts.require('./helpers/StandardTokenPlus')
var Standard23Token = artifacts.require('./helpers/Standard23Token')

var IOrgan = artifacts.require('IOrgan')

const { installOrgans, installApps } = require('./helpers/installer')
const { sign } = require('./helpers/web3')

const createDAO = () => DAO.new(Kernel.address)

const zerothAddress = '0x0000000000000000000000000000000000000000'
const randomAddress = '0x0000000000000000000000000000000000001234'
const updateAddress = '0x0000000000000000000000000000000000004321'

contract('DAO msg', accounts => {
  let dao, metadao, kernel, vault, tester = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    await installOrgans(metadao, [MetaOrgan, VaultOrgan])

    vault = VaultOrgan.at(dao.address)
    await vault.setupEtherToken()
  })

  const tests = function () {
      it('for vanilla call', async () => {
          await tester.assertDaoMsg(accounts[0], zerothAddress, 0)
      })

      it('for value transfering calls', async () => {
          await tester.assertDaoMsg(accounts[0], zerothAddress, 1, { value: 1 })
      })

      it('for token calls', async () => {
          const token = await StandardTokenPlus.new()
          const data = tester.assertDaoMsg.request(accounts[0], token.address, 10).params[0].data

          await token.approveAndCall(dao.address, 10, data)
      })

      it('throws for incorrect params', async () => {
          try {
            await tester.assertDaoMsg(accounts[1], zerothAddress, 0)
          } catch (error) {
            return assertThrow(error)
          }
          assert.fail('should have thrown before')
      })
  }

  context('when dispatching organ calls has correct dao_msg', () => {
      beforeEach(async () => {
          await installOrgans(metadao, [DAOMsgOrgan])
          tester = DAOMsgOrgan.at(dao.address)
      })

      context('', tests)
  })

  context('when dispatching app calls has correct dao_msg', () => {
      let tester = {}
      beforeEach(async () => {
          await installApps(metadao, [DAOMsgApp])
          tester = DAOMsgApp.at(dao.address)
      })

      context('', tests)
  })
})
