const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var DispatcherOrgan = artifacts.require('DispatcherOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var BylawsApp = artifacts.require('./helpers/BylawsApp')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Bylaws', accounts => {
  let dao, metadao, kernel, appOrgan, bylawsApp = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const apps = await ApplicationOrgan.new()
    await metadao.installOrgan(apps.address, 3)
    appOrgan = ApplicationOrgan.at(dao.address)

    bylawsApp = await BylawsApp.new(dao.address)
    await appOrgan.installApp(1, bylawsApp.address)
    await metadao.setPermissionsOracle(bylawsApp.address)
  })

  it('bylaws are successfully installed', async () => {
    assert.equal(await kernel.getPermissionsOracle(), bylawsApp.address, 'should have set permissions oracle')
    assert.equal(await appOrgan.getApp(1), bylawsApp.address, 'should have returned installed app addr')
  })
})
