const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var Kernel = artifacts.require('Kernel')
var MockedOrgan = artifacts.require('mocks/MockedOrgan')

const createDAO = () => DAO.new()

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('DAO', accounts => {
  it('creates a DAO', async () => {
    const dao = await createDAO()

    assert.equal(await dao.getSelf(), dao.address, 'Self should reference DAO')
    assert.notEqual(await dao.getKernel(), zerothAddress, 'Kernel should be deployed')
  })

  describe('after DAO creation', () => {
    let dao = {}
    let metadao = {}
    let kernel = {}

    beforeEach(async () => {
      dao = await createDAO()
      metadao = MetaOrgan.at(dao.address)
      kernel = Kernel.at(dao.address)
    })

    it('can change kernel reference', async () => {
      assert.notEqual(await dao.getKernel(), zerothAddress, 'Kernel should be deployed')
      assert.notEqual(await dao.getKernel(), randomAddress, 'Kernel shouldnt be other addr')

      await metadao.replaceKernel(randomAddress)
      await metadao.replaceKernel('0xbeef') // second change shouldn't affect as it is done to non-kernel

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('allows any action to happen before further config', async () => {
      const canPerform = await kernel.canPerformAction('0x1', '0x2', 123, '0x1234')

      assert.isTrue(canPerform, 'DAO should allow all actions')
    })

    it('can set ether token', async () => {
      await metadao.setEtherToken(randomAddress)
      assert.equal(await kernel.getEtherToken(), randomAddress, 'Should have new ether token')
    })

    it('can install organs', async () => {
      const mockOrgan = await MockedOrgan.new()
      await metadao.installOrgan(mockOrgan.address, 3)
      assert.equal(await kernel.getOrgan(3), mockOrgan.address, 'DAO should have installed organ')
    })
  })
})
