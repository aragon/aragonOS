const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var TokensOrgan = artifacts.require('TokensOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeToken')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

contract('OwnershipApp', accounts => {
  let dao, metadao, kernel, appOrgan, ownershipApp, dao_ownershipApp = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const tokensOrgan = await TokensOrgan.new()
    await metadao.installOrgan(tokensOrgan.address, 3)

    const actionsOrgan = await ActionsOrgan.new()
    await metadao.installOrgan(actionsOrgan.address, 4)

    const apps = await ApplicationOrgan.new()
    await metadao.installOrgan(apps.address, 5)
    appOrgan = ApplicationOrgan.at(dao.address)

    ownershipApp = await OwnershipApp.new(dao.address)
    dao_ownershipApp = OwnershipApp.at(dao.address)

    await appOrgan.installApp(1, ownershipApp.address)
  })

  context('adding new token', () => {
    let token = {}

    beforeEach(async () => {
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await dao_ownershipApp.addToken(token.address, 0, { gas: 1e6 })
    })

    it('added the token', async () => {
      assert.equal(await ownershipApp.getTokenAddress(0), token.address, 'token address should match in app')
      assert.equal(await TokensOrgan.at(dao.address).getToken(0), token.address, 'token address should match in organ')
      assert.equal(await TokensOrgan.at(dao.address).getTokenCount(), 1, 'token count should be 1')
    })

    it('removes the token', async () => {
      await dao_ownershipApp.removeToken(0)
      assert.equal(await TokensOrgan.at(dao.address).getTokenCount(), 0, 'token count should be 0')
    })

    it('replaces removed token', async () => {
      await dao_ownershipApp.removeToken(0)
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await dao_ownershipApp.addToken(token.address, 0, { gas: 1e6 })
      assert.equal(await ownershipApp.getTokenAddress(0), token.address, 'token address should match in app')
    })

    it('issues new tokens to DAO', async () => {
      await dao_ownershipApp.issueTokens(0, 100, { gas: 1e6 })
      assert.equal(await token.totalSupply(), 100, 'should have correct total supply after issueing')
      assert.equal(await token.balanceOf(dao.address), 100, 'DAO should have correct balance after issueing')
    })
  })
})
