const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')
var MockedApp = artifacts.require('./mocks/MockedApp')
var IOrgan = artifacts.require('IOrgan')
var Application = artifacts.require('Application')
var StandardTokenPlus = artifacts.require('./helpers/StandardTokenPlus')

const { signatures, getBalance } = require('./helpers/web3')
const { installOrgans } = require('./helpers/installer')

var Kernel = artifacts.require('Kernel')

const createDAO = () => DAO.new(Kernel.address)

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Applications', accounts => {
  let dao, metadao, kernel, vault = {}

  beforeEach(async () => {
    dao = await createDAO()

    metadao = MetaOrgan.at(dao.address)
    await installOrgans(metadao, [MetaOrgan, VaultOrgan])

    vault = VaultOrgan.at(dao.address)
    await vault.setupEtherToken()

    kernel = Kernel.at(dao.address)
  })

  context('installed app', () => {
    let mockApp = {}
    let dao_mockApp = {}

    beforeEach(async () => {
      mockApp = await MockedApp.new(dao.address)
      dao_mockApp = MockedApp.at(dao.address)
      await metadao.installApp(mockApp.address, signatures(MockedApp, [Application], web3))
    })

    it('returns installed app address', async () => {
      const [addr, delegate] = await kernel.get(signatures(MockedApp, [Application], web3)[0])
      assert.equal(addr, mockApp.address, 'should have returned installed app addr')
      assert.isFalse(delegate, 'Call to application shouldnt be delegate')
    })

    it('dispatches actions in apps', async () => {
      await dao_mockApp.doStuff()

      assert.isTrue(await mockApp.didStuff(), 'should have done stuff')
    })

    it('throws when performing dao only methods from outside', async () => {
      try {
        await mockApp.doStuff()
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('can perform unprotected methods from the outside', async () => {
      await mockApp.unprotectedDoStuff()
      assert.isTrue(await mockApp.didStuff(), 'should have done stuff')
    })

    it('can save stuck ether in app', async () => {
        const value = 101
        await mockApp.stuckETH({ value })
        assert.equal(await getBalance(mockApp.address), value, 'ether should be in app')

        await mockApp.unstuckToken(0, { gas: 5e6 })

        assert.equal(await getBalance(mockApp.address), 0, 'balance should be 0 after unstucking it')
        const etherToken = StandardTokenPlus.at(await vault.getEtherToken())
        assert.equal(await etherToken.balanceOf(dao.address), value, 'dao should have ether in ether token')
        assert.equal(await vault.getTokenBalance(etherToken.address), value, 'DAO accounting should know ether balance')
    })

    it('can save stuck tokens in app', async () => {
        const token = await StandardTokenPlus.new()

        await token.transfer(mockApp.address, 10)
        await mockApp.unstuckToken(token.address)

        assert.equal(await token.balanceOf(mockApp.address), 0, 'token balance should be 0 after unstucking it')
        assert.equal(await token.balanceOf(dao.address), 10, 'dao should have received token balance')
        assert.equal(await vault.getTokenBalance(token.address), 10, 'DAO accounting should know ether balance')
    })
  })
})
