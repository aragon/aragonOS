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

const zerothAddress = '0x0000000000000000000000000000000000000000'
const randomAddress = '0x0000000000000000000000000000000000001234'
const updateAddress = '0x0000000000000000000000000000000000004321'


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

  const randSig = '0x12345678'

  context('registering organs', () => {
    beforeEach(async () => {
      await metadao.installOrgan(randomAddress, [randSig])
    })

    it('was registered', async () => {
      const [addr, isDelegate] = await kernel.get(randSig)

      assert.equal(addr, randomAddress, 'registered address should match')
      assert.isTrue(isDelegate, 'registered organ should be delegate')
    })

    it('can be overwritten', async () => {
      await metadao.installOrgan(randomAddress, [randSig])
    })

    it('can be removed', async () => {
      await metadao.removeOrgan([randSig])
      const [addr, isDelegate] = await kernel.get(randSig)

      assert.equal(addr, zerothAddress, 'removed organ should return 0 address')
    })

    it('can be updated', async () => {
      await metadao.updateOrgan(updateAddress, [randSig])
      const [addr, isDelegate] = await kernel.get(randSig)

      assert.equal(addr, updateAddress, 'removed organ should return 0 address')
    })    

    it('throws when being removed as part of other sigs array', async () => {
      try {
        await metadao.removeOrgan([randSig, '0x50'])
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws when adding bad ordered sigs', async () => {
      try {
        await metadao.installOrgan(randomAddress, ['0x12', '0x50', '0x40'])
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('registering apps', () => {
    beforeEach(async () => {
      await metadao.installApp(randomAddress, [randSig])
    })

    it('was registered', async () => {
      const [addr, isDelegate] = await kernel.get(randSig)

      assert.equal(addr, randomAddress, 'registered address should match')
      assert.isFalse(isDelegate, 'registered app should not be delegate')
    })

    it('can only be overwriten by an organ', async () => {
      try {
        await metadao.installApp(randomAddress, [randSig])
      } catch (error) {
        await metadao.installOrgan(randomAddress, [randSig])
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('can be removed', async () => {
      await metadao.removeApp([randSig])
      const [addr, isDelegate] = await kernel.get(randSig)

      assert.equal(addr, zerothAddress, 'removed app should return 0 address')
    })

    it('can be updated', async () => {
      await metadao.updateApp(updateAddress, [randSig])
      const [addr, isDelegate] = await kernel.get(randSig)

      assert.equal(addr, updateAddress, 'removed organ should return 0 address')
    })      

    it('throws when being removed as part of other sigs array', async () => {
      try {
        await metadao.removeApp([randSig, '0x50'])
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws when adding bad ordered sigs', async () => {
      try {
        await metadao.installApp(randomAddress, ['0x12', '0x50', '0x40'])
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })
})
