const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var DispatcherOrgan = artifacts.require('DispatcherOrgan')
var Kernel = artifacts.require('Kernel')
var VaultOrgan = artifacts.require('VaultOrgan')
var EtherToken = artifacts.require('EtherToken')
var MockedOrgan = artifacts.require('./mocks/MockedOrgan')
var StandardTokenPlus = artifacts.require('./helpers/StandardTokenPlus')
var Standard23Token = artifacts.require('./helpers/Standard23Token')
const { getBalance } = require('./helpers/web3')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Vault', accounts => {
  let dao, metadao, kernel, mockedOrgan, vault = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const vaultOrgan = await VaultOrgan.new()
    await metadao.installOrgan(vaultOrgan.address, 3)
    vault = VaultOrgan.at(dao.address)

    const mockOrgan = await MockedOrgan.new()
    await metadao.installOrgan(mockOrgan.address, 4)
    mockedOrgan = MockedOrgan.at(dao.address)
  })

  context('after receiving ether', () => {
    let token = {}
    beforeEach(async () => {
      token = EtherToken.at(await kernel.getEtherToken())
      await mockedOrgan.mock_setNumber(3, { value: 10, gas: 10000000 })
    })

    it('has correct accounted token balance', async () => {
      assert.equal(await token.balanceOf(dao.address), 10, 'DAO should have token balance')
      assert.equal(await vault.getTokenBalance(token.address), 10, 'DAO accounting should know token balance')
    })

    it('can transfer tokens', async () => {
      await vault.transfer(token.address, randomAddress, 5)

      assert.equal(await token.balanceOf(dao.address), 5, 'DAO should have token balance')
      assert.equal(await token.balanceOf(randomAddress), 5, 'receiver should have token balance')
      assert.equal(await vault.getTokenBalance(token.address), 5, 'DAO accounting should know token balance')
    })

    it('can transfer ether', async () => {
      await vault.transferEther(randomAddress, 6)

      assert.equal(await getBalance(randomAddress), 6, 'receiver should have correct ether balance')
      assert.equal(await token.balanceOf(dao.address), 4, 'DAO should have token balance')
    })

    it('throws when transfering more tokens than owned', async () => {
      try {
        await vault.transfer(token.address, accounts[8], 11)
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })
})
