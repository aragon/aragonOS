const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeIrrevocableVestedToken')
var Controller = artifacts.require('Controller')
var IndividualSale = artifacts.require('mocks/IndividualSaleMock')
var PublicSale = artifacts.require('mocks/PublicSaleMock')
var VariablePriceSale = artifacts.require('mocks/VariablePriceSaleMock')
var StandardTokenPlus = artifacts.require('StandardTokenPlus')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new(Kernel.address, { gas: 9e6 })

contract('Token sales', accounts => {
  let dao, metadao, kernel, appOrgan, ownershipApp, dao_ownershipApp, vault, token = {}

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

    token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
    await token.changeController(dao.address)
    await dao_ownershipApp.addToken(token.address, 0, 1, 1, { gas: 1e6 })
  })

  context('creating individual token sale', () => {
    let sale, raiseToken = {}
    const buyer = accounts[3]

    beforeEach(async () => {
      raiseToken = await StandardTokenPlus.new()
      await raiseToken.transfer(buyer, 80)

      sale = await IndividualSale.new()
      await sale.mock_setBlockNumber(10)

      await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, buyer, 60, 30, 20)
      await dao_ownershipApp.createTokenSale(sale.address, token.address, false)
    })

    it('sale throws when when sale expiry block is past', async () => {
      sale = await IndividualSale.new();

      try {
        await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, buyer, 60, 30, 19)
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('saves sale information', async () => {
      const [saleAddress, tokenAddress, canDestroy, closed] = await ownershipApp.getTokenSale(1)

      assert.equal(await ownershipApp.getTokenSaleCount(), 1, 'token sale count should match')
      assert.equal(saleAddress, sale.address, 'sale addr should be correct')
      assert.equal(tokenAddress, token.address, 'token addr should be correct')
      assert.equal(canDestroy, false, 'can destroy should be correct')
      assert.equal(closed, false, 'closed should be correct')
      assert.equal(await sale.buyer(), buyer, 'buyer address should be correct')
      assert.equal(await sale.tokensOffered(), 30, 'tokens sold should be correct')
      assert.equal(await sale.buyAmount(), 60, 'tokens price should be correct')
      assert.equal(await sale.expireBlock(), 20, 'expiry block should be correct')
    })

    it('throws when re-instantiating sale', async () => {
      try {
        await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, buyer, 60, 30, 101)
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

    it('throws when buying after expiry block', async () => {
      await sale.mock_setBlockNumber(21)
      try {
        await raiseToken.approveAndCall(sale.address, 60, '0x', { from: buyer })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
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

  context('creating ether individual token sale', () => {
    let sale = {}
    const buyer = accounts[3]

    beforeEach(async () => {
      const etherToken = await vault.getEtherToken()

      sale = await IndividualSale.new()
      await sale.mock_setBlockNumber(10)
      await sale.instantiate(dao.address, ownershipApp.address, etherToken, token.address, buyer, 60, 30, 20)
      await dao_ownershipApp.createTokenSale(sale.address, token.address, false)
    })

    it('can buy with ether', async () => {
      await sale.buy(buyer, { from: buyer, value: 60 })
      assert.equal(await token.balanceOf(buyer), 30, 'should have received tokens')
    })
  })

  context('creating public sale', () => {
    let sale, raiseToken = {}
    const buyer = accounts[3]

    beforeEach(async () => {
      raiseToken = await StandardTokenPlus.new()
      await raiseToken.transfer(buyer, 80)

      sale = await PublicSale.new()
      await sale.mock_setBlockNumber(10)

      await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, 30, 1, 2, false, 15, 20)
      await dao_ownershipApp.createTokenSale(sale.address, token.address, false)
    })

    it('saves sale information', async () => {
      assert.equal(await sale.cap(), 30)
      assert.equal(await sale.minBuy(), 1)
      assert.equal(await sale.exchangeRate(), 2)
      assert.equal(await sale.isInverseRate(), false)
      assert.equal(await sale.startBlock(), 15)
      assert.equal(await sale.closeBlock(), 20)
    })

    it('can buy more than cap which closes sale', async () => {
      await sale.mock_setBlockNumber(15)
      await raiseToken.approveAndCall(sale.address, 80, '0x', { from: buyer })

      assert.equal(await token.balanceOf(buyer), 60, 'should have received tokens')
      assert.equal(await raiseToken.balanceOf(dao.address), 30, 'dao should have tokens')
      assert.equal(await raiseToken.balanceOf(buyer), 50, 'buyer should have received remaining tokens')
      const [s, t, c, closed] = await ownershipApp.getTokenSale(1)
      assert.equal(closed, true, 'Sale should be closed')
    })

    it('can buy normal amount', async () => {
      await sale.mock_setBlockNumber(15)
      await raiseToken.approveAndCall(sale.address, 20, '0x', { from: buyer })

      assert.equal(await token.balanceOf(buyer), 40, 'should have received tokens')
      assert.equal(await raiseToken.balanceOf(sale.address), 20, 'dao should have tokens')
      const [s, t, c, closed] = await ownershipApp.getTokenSale(1)
      assert.equal(closed, false, 'Sale should not be closed')
    })

    it('throws when buying before starting', async () => {
      await sale.mock_setBlockNumber(14)
      try {
        await raiseToken.approveAndCall(sale.address, 60, '0x', { from: buyer })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('can close sale after close block', async () => {
      await sale.mock_setBlockNumber(21)
      await sale.close();
      const [s, t, c, closed] = await ownershipApp.getTokenSale(1)
      assert.equal(closed, true, 'Sale should be closed')
    })
  })

  context('variable sales', () => {
    let sale, raiseToken = {}
    const buyer = accounts[3]

    beforeEach(async () => {
      raiseToken = await StandardTokenPlus.new()
      await raiseToken.transfer(buyer, 80)
    })

    const assertAcquiredTokens = async (block, sent, expected) => {
      await sale.mock_setBlockNumber(block)
      assert.equal(await sale.getAcquiredTokens(sent), expected, 'should have acquired expected tokens')
    }

    it('can handle decreasing price sale', async () => {
      sale = await VariablePriceSale.new()
      await sale.mock_setBlockNumber(10)

      await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, 30, 1, false, 15, [20, 28], [1, 0, 2, 10])

      await assertAcquiredTokens(16, 1, 1)
      await assertAcquiredTokens(18, 1, 1)
      await assertAcquiredTokens(20, 1, 2)
      await assertAcquiredTokens(23, 1, 5)
      await assertAcquiredTokens(27, 1, 9)
    })

    it('can handle increasing price sale', async () => {
      sale = await VariablePriceSale.new()
      await sale.mock_setBlockNumber(10)

      await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, 30, 1, false, 15, [20, 28], [1, 0, 10, 2])

      await assertAcquiredTokens(16, 1, 1)
      await assertAcquiredTokens(18, 1, 1)
      await assertAcquiredTokens(20, 1, 10)
      await assertAcquiredTokens(23, 1, 7)
      await assertAcquiredTokens(27, 1, 3)
    })

    it('can handle inverse price sales', async () => {
      sale = await VariablePriceSale.new()
      await sale.mock_setBlockNumber(10)

      await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, 30, 1, true, 15, [20, 28], [2, 0, 2, 4])

      await assertAcquiredTokens(20, 10, 5)
      await assertAcquiredTokens(22, 20, 8)
      await assertAcquiredTokens(24, 21, 7)
    })

    it('can handle buys, state transitions and capping', async () => {
      sale = await VariablePriceSale.new()
      await dao_ownershipApp.createTokenSale(sale.address, token.address, false)

      await sale.mock_setBlockNumber(10)

      await sale.instantiate(dao.address, ownershipApp.address, raiseToken.address, token.address, 30, 1, true, 15, [20, 28], [2, 0, 2, 4])

      sale.mock_setBlockNumber(20)
      await raiseToken.approveAndCall(sale.address, 20, '0x', { from: buyer })
      assert.equal(await token.balanceOf(buyer), 10, 'should have received tokens')
      assert.equal(await raiseToken.balanceOf(sale.address), 20, 'sale should have tokens')

      sale.mock_setBlockNumber(24)
      await raiseToken.approveAndCall(sale.address, 60, '0x', { from: buyer })
      assert.equal(await token.balanceOf(buyer), 13, 'should have received tokens')
      assert.equal(await raiseToken.balanceOf(dao.address), 30, 'dao should have tokens')

      const [s, t, c, closed] = await ownershipApp.getTokenSale(1)
      assert.equal(closed, true, 'Sale should not be closed')
    })
  })
})
