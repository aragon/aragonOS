const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var Kernel = artifacts.require('Kernel')
var VaultOrgan = artifacts.require('VaultOrgan')
var EtherToken = artifacts.require('EtherToken')
var MockedOrgan = artifacts.require('./mocks/MockedOrgan')
var StandardTokenPlus = artifacts.require('./helpers/StandardTokenPlus')
var Standard23Token = artifacts.require('./helpers/Standard23Token')

var IOrgan = artifacts.require('IOrgan')

const { installOrgans } = require('./helpers/installer')
const { sign } = require('./helpers/web3')

const createDAO = () => DAO.new(Kernel.address)

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Registry', accounts => {
  let dao, metadao, kernel, mockedOrgan, vault = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    await installOrgans(metadao, [MetaOrgan, VaultOrgan, MockedOrgan])

    vault = VaultOrgan.at(dao.address)
    await vault.setupEtherToken()
    mockedOrgan = MockedOrgan.at(dao.address)
  })
})
