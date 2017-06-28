const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var BylawsApp = artifacts.require('BylawsApp')
var BylawOracleMock = artifacts.require('mocks/BylawOracleMock')

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

  context('adding address bylaw', () => {
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

  context('adding oracle bylaw', () => {
    let oracle = {}
    beforeEach(async () => {
      oracle = await BylawOracleMock.new()
      await dao_bylawsApp.setAddressBylaw('0xcebe30ac', oracle.address, true, false)
    })

    it('allows action when oracle is enabled', async () => {
      await oracle.changeAllow(true)
      await metadao.replaceKernel(randomAddress, { from: accounts[1] })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when oracle is disabled and does action', async () => {
      await oracle.changeAllow(false)
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[2] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding negated address bylaw', () => {
    beforeEach(async () => {
      await dao_bylawsApp.setAddressBylaw('0xcebe30ac', accounts[1], false, true)
    })

    it('allows action by any other than specified address', async () => {
      await metadao.replaceKernel(randomAddress, { from: accounts[2] })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when authorized address does action', async () => {
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[1] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })
})
