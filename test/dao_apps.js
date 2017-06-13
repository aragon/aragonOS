const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var DispatcherOrgan = artifacts.require('DispatcherOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var MockedApp = artifacts.require('./helpers/MockedApp')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Applications', accounts => {
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
    let mockApp = {}
    let dao_mockApp = {}

    beforeEach(async () => {
      mockApp = await MockedApp.new(dao.address)
      dao_mockApp = MockedApp.at(dao.address)
      await appOrgan.installApp(1, mockApp.address)
    })

    it('returns installed app address', async () => {
      assert.equal(await appOrgan.getApp(1), mockApp.address, 'should have returned installed app addr')
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
