const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var TokensOrgan = artifacts.require('TokensOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeIrrevocableVestedToken')
var Controller = artifacts.require('Controller')

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
      await dao_ownershipApp.addOrgToken(token.address, 0, 1, 1, { gas: 1e6 })
    })

    it('added the token', async () => {
      assert.equal(await ownershipApp.getTokenAddress(0), token.address, 'token address should match in app')
      assert.equal(await TokensOrgan.at(dao.address).getToken(0), token.address, 'token address should match in organ')
      assert.equal(await TokensOrgan.at(dao.address).getTokenCount(), 1, 'token count should be 1')

      const [tokenAddress, governanceRights, economicRights] = await ownershipApp.getOrgToken(0)
      assert.equal(tokenAddress, token.address, 'token address should match in app')
      assert.equal(governanceRights, 1, 'gov rights should match in app')
      assert.equal(economicRights, 1, 'econ rights should match in app')
    })

    it('removes the token', async () => {
      await dao_ownershipApp.removeOrgToken(0)
      assert.equal(await TokensOrgan.at(dao.address).getTokenCount(), 0, 'token count should be 0')
    })

    it('replaces removed token', async () => {
      await dao_ownershipApp.removeOrgToken(0)
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await dao_ownershipApp.addOrgToken(token.address, 0, 1, 1, { gas: 1e6 })
      assert.equal(await ownershipApp.getTokenAddress(0), token.address, 'token address should match in app')
    })

    it('add second token and issue', async () => {
      const token2 = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token2.changeController(dao.address)

      await dao_ownershipApp.addOrgToken(token2.address, 150, 1, 1, { gas: 1e6 })

      assert.equal(await token2.totalSupply(), 150, 'should have correct total supply after issueing')
      assert.equal(await token2.balanceOf(dao.address), 150, 'DAO should have correct balance after issueing')
      assert.equal(await ownershipApp.getTokenAddress(1), token2.address, 'token address should match in app')
      assert.equal(await TokensOrgan.at(dao.address).getToken(1), token2.address, 'token address should match in organ')
      assert.equal(await TokensOrgan.at(dao.address).getTokenCount(), 2, 'token count should be 1')
    })

    context('after issuing tokens', async () => {
      beforeEach(async () => {
        await dao_ownershipApp.issueTokens(0, 100, { gas: 1e6 })
      })

      it('are properly allocated', async () => {
        assert.equal(await token.totalSupply(), 100, 'should have correct total supply after issueing')
        assert.equal(await token.balanceOf(dao.address), 100, 'DAO should have correct balance after issueing')
      })

      it('can grant tokens', async () => {
        await dao_ownershipApp.grantTokens(0, 10, accounts[1], { gas: 2e6 })

        assert.equal(await token.balanceOf(accounts[1]), 10, 'balances should be correct after transfer')
        assert.equal(await token.balanceOf(dao.address), 90, 'balances should be correct after transfer')
      })

      it('can grant vested tokens', async () => {
        const safenow = parseInt(+new Date()/1000 + 1000)

        await dao_ownershipApp.grantVestedTokens(0, 10, accounts[1], safenow, safenow + 1, safenow + 2)
        assert.equal(await token.balanceOf(accounts[1]), 10, 'balances should be correct after transfer')
        assert.equal(await token.balanceOf(dao.address), 90, 'balances should be correct after transfer')
      })
    })
  })
})
