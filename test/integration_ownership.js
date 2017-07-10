const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeIrrevocableVestedToken')
var Controller = artifacts.require('Controller')
var IndividualSale = artifacts.require('IndividualSale')
var StandardTokenPlus = artifacts.require('StandardTokenPlus')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new({ gas: 9e6 })

contract('OwnershipApp', accounts => {
  let dao, metadao, kernel, appOrgan, ownershipApp, dao_ownershipApp, vault = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const vaultOrgan = await VaultOrgan.new()
    await metadao.installOrgan(vaultOrgan.address, 3)
    vault = VaultOrgan.at(dao.address)

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
      await dao_ownershipApp.addToken(token.address, 0, 1, 1, { gas: 1e6 })
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
      await dao_ownershipApp.removeToken(token.address)
      assert.equal(await ownershipApp.getTokenCount(), 0, 'token count should be 0')
    })

    it('replaces removed token', async () => {
      await dao_ownershipApp.removeToken(token.address)
      token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await dao_ownershipApp.addToken(token.address, 0, 1, 1, { gas: 1e6 })
      assert.equal(await ownershipApp.getTokenAddress(1), token.address, 'token address should match in app')
    })

    it('add second token and issue', async () => {
      const token2 = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token2.changeController(dao.address)

      await dao_ownershipApp.addToken(token2.address, 150, 1, 1, { gas: 1e6 })

      assert.equal(await token2.totalSupply(), 150, 'should have correct total supply after issueing')
      assert.equal(await token2.balanceOf(dao.address), 150, 'DAO should have correct balance after issueing')
      assert.equal(await ownershipApp.getTokenAddress(2), token2.address, 'token address should match in app')
      assert.equal(await ownershipApp.getTokenCount(), 2, 'token count should be 1')
    })

    context('after issuing tokens', async () => {
      beforeEach(async () => {
        await dao_ownershipApp.issueTokens(token.address, 100, { gas: 1e6 })
      })

      it('are properly allocated', async () => {
        assert.equal(await token.totalSupply(), 100, 'should have correct total supply after issueing')
        assert.equal(await token.balanceOf(dao.address), 100, 'DAO should have correct balance after issueing')
      })

      it('can grant tokens', async () => {
        await dao_ownershipApp.grantTokens(token.address, accounts[1], 10, { gas: 2e6 })

        assert.equal(await token.balanceOf(accounts[1]), 10, 'balances should be correct after transfer')
        assert.equal(await token.balanceOf(dao.address), 90, 'balances should be correct after transfer')
      })

      it('can grant vested tokens', async () => {
        const safenow = parseInt(+new Date()/1000 + 1000)

        await dao_ownershipApp.grantVestedTokens(token.address, accounts[1], 10, safenow, safenow + 1, safenow + 2)
        assert.equal(await token.balanceOf(accounts[1]), 10, 'balances should be correct after transfer')
        assert.equal(await token.balanceOf(dao.address), 90, 'balances should be correct after transfer')
      })
    })

    context('creating token sale', () => {
      let sale, raiseToken = {}
      const buyer = accounts[3]

      beforeEach(async () => {
        raiseToken = await StandardTokenPlus.new()
        await raiseToken.transfer(buyer, 80)

        sale = await IndividualSale.new();
        await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, buyer, 2, 30)
        await dao_ownershipApp.createTokenSale(sale.address, token.address, false)
      })

      it('saves sale information', async () => {
        const [saleAddress, tokenAddress, canDestroy, closed] = await ownershipApp.getTokenSale(1)

        assert.equal(await ownershipApp.getTokenSaleCount(), 1, 'token sale count should match')
        assert.equal(saleAddress, sale.address, 'sale addr should be correct')
        assert.equal(tokenAddress, token.address, 'token addr should be correct')
        assert.equal(canDestroy, false, 'can destroy should be correct')
        assert.equal(closed, false, 'closed should be correct')
        assert.equal(await sale.buyer(), buyer, 'buyer address should be correct')
        assert.equal(await sale.tokensSold(), 30, 'tokens sold should be correct')
        assert.equal(await sale.price(), 2, 'tokens price should be correct')
      })

      it('throws when re-instantiating sale', async () => {
        try {
          await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, buyer, 2, 30)
        } catch (error) {
          return assertThrow(error)
        }
        assert.fail('should have thrown before')
      })

      it('allows to buy if sending exact amount', async () => {
        await raiseToken.approveAndCall(sale.address, 60, '0x', { from: buyer })
        assert.equal(await token.balanceOf(buyer), 30, 'should have received tokens')
        assert.equal(await raiseToken.balanceOf(dao.address), 60, 'dao should have tokens')
        assert.equal(await raiseToken.balanceOf(buyer), 20, 'buyer should have remaining tokens')
        const [s, t, c, closed] = await ownershipApp.getTokenSale(1)
        assert.equal(closed, true, 'Sale should be closed')
      })

      it('dao can close sale unilateraly', async () => {
        await dao_ownershipApp.closeTokenSale(sale.address)
        try {
          await raiseToken.approveAndCall(sale.address, 60, '0x', { from: buyer })
        } catch (error) {
          return assertThrow(error)
        }
        assert.fail('should have thrown before')
      })
    })

    context('creating ether token sale', () => {
      let sale = {}
      const buyer = accounts[3]

      beforeEach(async () => {
        const etherToken = await vault.getEtherToken()

        sale = await IndividualSale.new();
        await sale.instantiate(dao.address, ownershipApp.address, etherToken, token.address, buyer, 2, 30)
        await dao_ownershipApp.createTokenSale(sale.address, token.address, false)
      })

      it('can buy with ether', async () => {
        await sale.buy(buyer, { from: buyer, value: 60 })
        assert.equal(await token.balanceOf(buyer), 30, 'should have received tokens')
      })
    })
  })
})
