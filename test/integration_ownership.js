const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var TokensOrgan = artifacts.require('TokensOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeToken')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('OwnershipApp', accounts => {
  let dao, metadao, kernel, appOrgan, ownershipApp, dao_ownershipApp = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const tokensOrgan = await TokensOrgan.new()
    await metadao.installOrgan(tokensOrgan.address, 3)

    const apps = await ApplicationOrgan.new()
    await metadao.installOrgan(apps.address, 4)
    appOrgan = ApplicationOrgan.at(dao.address)

    console.log(await TokensOrgan.at(dao.address).getToken(0))

    ownershipApp = await OwnershipApp.new(dao.address)
    dao_ownershipApp = OwnershipApp.at(dao.address)

    await appOrgan.installApp(1, ownershipApp.address)
  })

  context('adding new token', () => {
    let token = {}

    beforeEach(async () => {
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      console.log('adding token', token.address, dao.address, await token.controller())
      await dao_ownershipApp.addToken(token.address, 0, { gas: 1e6 })
    })

    it('adds the token', async () => {
      assert.equal(await ownershipApp.getTokenAddress(0), token.address, 'token address should match in app')
      assert.equal(await TokensOrgan.at(dao.address).getToken(0), token.address, 'token address should match in organ')
    })
  })
})
