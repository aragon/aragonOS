const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeIrrevocableVestedToken')
var Controller = artifacts.require('Controller')
var IndividualSale = artifacts.require('mocks/IndividualSaleMock')
var StandardTokenPlus = artifacts.require('StandardTokenPlus')

const { installOrgans, installApps } = require('./helpers/installer')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new(Kernel.address, { gas: 9e6 })

contract('OwnershipApp', accounts => {
  let dao, metadao, kernel, appOrgan, ownershipApp = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    await installOrgans(metadao, [MetaOrgan, VaultOrgan, ActionsOrgan])
    await installApps(metadao, [OwnershipApp])

    await VaultOrgan.at(dao.address).setupEtherToken()

    ownershipApp = OwnershipApp.at(dao.address)
  })

  context('adding new token', () => {
    let token = {}

    beforeEach(async () => {
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await ownershipApp.addToken(token.address, 0, 1, 1, { gas: 1e6 })
    })

    it('added the token', async () => {
      assert.equal(await ownershipApp.getTokenAddress(1), token.address, 'token address should match')
      assert.equal(await ownershipApp.getTokenCount(), 1, 'token count should be 1')

      const [tokenAddress, governanceRights, economicRights] = await ownershipApp.getToken(1)
      assert.equal(tokenAddress, token.address, 'token address should match in app')
      assert.equal(governanceRights, 1, 'gov rights should match in app')
      assert.equal(economicRights, 1, 'econ rights should match in app')
    })

    it('removes the token', async () => {
      await ownershipApp.removeToken(token.address)
      assert.equal(await ownershipApp.getTokenCount(), 0, 'token count should be 0')
    })

    it('replaces removed token', async () => {
      await ownershipApp.removeToken(token.address)
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await ownershipApp.addToken(token.address, 0, 1, 1, { gas: 1e6 })
      assert.equal(await ownershipApp.getTokenAddress(1), token.address, 'token address should match in app')
    })

    it('add second token and issue', async () => {
      const token2 = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token2.changeController(dao.address)

      await ownershipApp.addToken(token2.address, 150, 1, 1, { gas: 1e6 })

      assert.equal(await token2.totalSupply(), 150, 'should have correct total supply after issueing')
      assert.equal(await token2.balanceOf(dao.address), 150, 'DAO should have correct balance after issueing')
      assert.equal(await ownershipApp.getTokenAddress(2), token2.address, 'token address should match in app')
      assert.equal(await ownershipApp.getTokenCount(), 2, 'token count should be 1')
    })

    context('after issuing tokens', async () => {
      beforeEach(async () => {
        await ownershipApp.issueTokens(token.address, 100, { gas: 1e6 })
      })

      it('are properly allocated', async () => {
        assert.equal(await token.totalSupply(), 100, 'should have correct total supply after issueing')
        assert.equal(await token.balanceOf(dao.address), 100, 'DAO should have correct balance after issueing')
      })

      it('can grant tokens', async () => {
        await ownershipApp.grantTokens(token.address, accounts[1], 10, { gas: 2e6 })

        assert.equal(await token.balanceOf(accounts[1]), 10, 'balances should be correct after transfer')
        assert.equal(await token.balanceOf(dao.address), 90, 'balances should be correct after transfer')
      })

      it('can grant vested tokens', async () => {
        const safenow = parseInt(+new Date()/1000 + 1000)

        await ownershipApp.grantVestedTokens(token.address, accounts[1], 10, safenow, safenow + 1, safenow + 2)
        assert.equal(await token.balanceOf(accounts[1]), 10, 'balances should be correct after transfer')
        assert.equal(await token.balanceOf(dao.address), 90, 'balances should be correct after transfer')
      })
    })
  })
})
