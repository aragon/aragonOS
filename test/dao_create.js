const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new()

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('DAO', function(accounts) {
  it('creates a DAO', async () => {
    const dao = await createDAO()

    assert.equal(await dao.getSelf(), dao.address, 'Self should reference DAO')
    assert.notEqual(await dao.getKernel(), zerothAddress, 'Kernel should be deployed')
  })

  describe('with DAO created', () => {
    let dao = {}
    let metadao = {}

    beforeEach(async () => {
      dao = await createDAO()
      metadao = MetaOrgan.at(dao.address)
    })

    it('can change kernel reference', async () => {
      assert.notEqual(await dao.getKernel(), zerothAddress, 'Kernel should be deployed')
      assert.notEqual(await dao.getKernel(), randomAddress, 'Kernel shouldnt be other addr')

      await metadao.replaceKernel(randomAddress)
      await metadao.replaceKernel('0xbeef') // second change shouldn't affect as it is done to non-kernel

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('allows any action to happen before further config', async () => {
      const kernel = await Kernel.at(dao.address)
      const canPerform = await kernel.canPerformAction('0x1', '0x2', 123, '0x1234')

      assert.isTrue(canPerform, 'DAO should allow all actions')
    })

    it('can set ether token', async () => {
      await metadao.setEtherToken(randomAddress)
      assert.equal(await metadao.getEtherToken(), randomAddress, 'Should have new ether token')
    })
  })
})
