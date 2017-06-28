const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var BylawsApp = artifacts.require('BylawsApp')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Bylaws', accounts => {
  let dao, metadao, kernel, appOrgan, bylawsApp, dao_bylawsApp = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const apps = await ApplicationOrgan.new()
    await metadao.installOrgan(apps.address, 3)
    appOrgan = ApplicationOrgan.at(dao.address)

    bylawsApp = await BylawsApp.new(dao.address)
    dao_bylawsApp = BylawsApp.at(dao.address)

    await appOrgan.installApp(1, bylawsApp.address)
    await metadao.setPermissionsOracle(bylawsApp.address)
  })

  it('bylaws are successfully installed', async () => {
    assert.equal(await kernel.getPermissionsOracle(), bylawsApp.address, 'should have set permissions oracle')
    assert.equal(await appOrgan.getApp(1), bylawsApp.address, 'should have returned installed app addr')
  })

  context('adding new bylaw to limit kernel replaces', () => {
    beforeEach(async () => {
      await dao_bylawsApp.setAddressBylaw('0xcebe30ac', accounts[1], false, false)
    })

    it('allows action by specified address', async () => {
      await metadao.replaceKernel(randomAddress, { from: accounts[1] })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when not authorized address does action', async () => {
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[2] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })
})
