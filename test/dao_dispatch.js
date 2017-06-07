const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var DispatcherOrgan = artifacts.require('DispatcherOrgan')
var Kernel = artifacts.require('Kernel')
var EtherToken = artifacts.require('EtherToken')
var MockedOrgan = artifacts.require('helpers/MockedOrgan')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Dispatcher', function(accounts) {
  let dao, metadao, kernel, mockedOrgan = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const mockOrgan = await MockedOrgan.new()
    await metadao.installOrgan(mockOrgan.address, 3)
    mockedOrgan = MockedOrgan.at(dao.address)
  })

  context('dispatches vanilla transaction', () => {
    it('with 0 ETH', async () => {
      await mockedOrgan.mock_setNumber(3)
      assert.equal(await mockedOrgan.mock_getNumber(), 3, 'should have dispatched method')
    })

    it('with more than 0 ether', async () => {
      const value = 101
      await mockedOrgan.mock_setNumber(3, { value })
      assert.equal(await mockedOrgan.mock_getNumber(), 3, 'should have dispatched method')

      const etherToken = EtherToken.at(await kernel.getEtherToken())
      assert.equal(await etherToken.balanceOf(dao.address), value, 'transferred ether should be inside ETH token')
    })
  })
})
