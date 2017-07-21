const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var MockedApp = artifacts.require('./mocks/MockedApp')
var IOrgan = artifacts.require('IOrgan')
var Application = artifacts.require('Application')

const { signatures } = require('./helpers/web3')
const { installOrgans } = require('./helpers/installer')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new(Kernel.address)

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Applications', accounts => {
  let dao, metadao, kernel = {}

  beforeEach(async () => {
    dao = await createDAO()

    metadao = MetaOrgan.at(dao.address)
    await installOrgans(metadao, [MetaOrgan])

    kernel = Kernel.at(dao.address)
  })

  context('installed app', () => {
    let mockApp = {}
    let dao_mockApp = {}

    beforeEach(async () => {
      mockApp = await MockedApp.new(dao.address)
      dao_mockApp = MockedApp.at(dao.address)
      await metadao.installApp(mockApp.address, signatures(MockedApp, [Application], web3))
    })

    it('returns installed app address', async () => {
      const [addr, delegate] = await kernel.get(signatures(MockedApp, [Application], web3)[0])
      assert.equal(addr, mockApp.address, 'should have returned installed app addr')
      assert.isFalse(delegate, 'Call to application shouldnt be delegate')
    })

    it('dispatches actions in apps', async () => {
      await dao_mockApp.doStuff()

      assert.isTrue(await mockApp.didStuff(), 'should have done stuff')
    })

    it('throws when performing dao only methods from outside', async () => {
      try {
        await mockApp.doStuff()
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('can perform unprotected methods from the outside', async () => {
      await mockApp.unprotectedDoStuff()
      assert.isTrue(await mockApp.didStuff(), 'should have done stuff')
    })
  })

})
