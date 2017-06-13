const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var DispatcherOrgan = artifacts.require('DispatcherOrgan')
var Kernel = artifacts.require('Kernel')
var EtherToken = artifacts.require('EtherToken')
var MockedOrgan = artifacts.require('./mocks/MockedOrgan')
var StandardTokenPlus = artifacts.require('./helpers/StandardTokenPlus')
var Standard23Token = artifacts.require('./helpers/Standard23Token')
const { sign } = require('./helpers/web3')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'

contract('Dispatcher', accounts => {
  let dao, metadao, kernel, mockedOrgan = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    const mockOrgan = await MockedOrgan.new()
    await metadao.installOrgan(mockOrgan.address, 3)
    mockedOrgan = MockedOrgan.at(dao.address)
  })

  context('dispatches vanilla transaction', () => {
    it('with 0 ETH', async () => {
      await mockedOrgan.mock_setNumber(3)
      assert.equal(await mockedOrgan.mock_getNumber(), 3, 'should have dispatched method')
    })

    it('with more than 0 ether', async () => {
      const value = 101
      await mockedOrgan.mock_setNumber(3, { value })
      assert.equal(await mockedOrgan.mock_getNumber(), 3, 'should have dispatched method')

      const etherToken = EtherToken.at(await kernel.getEtherToken())
      assert.equal(await etherToken.balanceOf(dao.address), value, 'transferred ether should be inside ETH token')
    })
  })

  context('dispatches presigned transactions', () => {
    const signer = accounts[0]
    const sender = accounts[1]

    const signedTransaction = async nonce => {
      const data = mockedOrgan.mock_setNumber.request(4).params[0].data
      const signingPayload = await kernel.personalSignedPayload(data, 1)
      const signature = await sign(signingPayload, signer)

      const adding0x = x => '0x'.concat(x)
      return { data, ...signature }
    }

    beforeEach(async () => {
      const nonce = 1
      const { r, s, v, data } = await signedTransaction(nonce)
      await kernel.preauthDispatch(data, nonce, r, s, v, { from: sender })
    })

    it('basic presigned dispatch', async () => {
      assert.equal(await mockedOrgan.mock_getNumber(), 4, 'should have dispatched method')
    })


    it('dispatches transaction using the signer identity', async () => {
      assert.equal(await mockedOrgan.mock_getSender(), signer, 'signer should have been the sender of the transaction')
    })

    it('allows value transfer with the transaction', async () => {
      const { r, s, v, data } = await signedTransaction(2)
      await kernel.preauthDispatch(data, 2, r, s, v, { from: sender, value: 1})

      const etherToken = EtherToken.at(await kernel.getEtherToken())
      assert.equal(await etherToken.balanceOf(dao.address), 1, 'transferred ether should be inside ETH token')
      assert.equal(await mockedOrgan.mock_getNumber(), 4, 'should have dispatched method')
    })

    it('throws when reusing signed payload', async () => {
      const { r, s, v, data } = await signedTransaction(1)
      try {
        await kernel.preauthDispatch(data, 1, r, s, v, { from: sender })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('dispatches token transactions', () => {
    it('using approveAndCall', async () => {
      const token = await StandardTokenPlus.new()
      const data = mockedOrgan.mock_setNumber.request(5).params[0].data

      await token.approveAndCall(dao.address, 10, data)

      assert.equal(await mockedOrgan.mock_getNumber(), 5, 'should have dispatched method')
      assert.equal(await token.balanceOf(dao.address), 10, 'DAO should have token balance')
    })

    it('using ERC223', async () => {
      const token = await Standard23Token.new()
      const data = mockedOrgan.mock_setNumber.request(5).params[0].data

      const erc23transfer = (a, v, d, p) => {
        return new Promise((resolve, reject) => {
          token.contract.transfer['address,uint256,bytes'](a, v, d, p, (err) => {
            if (err) return reject(err)
            resolve()
          })
        })
      }

      await erc23transfer(dao.address, 10, data, { from: accounts[0], gas: 4e6 })

      assert.equal(await token.balanceOf(dao.address), 10, 'DAO should have token balance')
      assert.equal(await mockedOrgan.mock_getNumber(), 5, 'should have dispatched method')
    })
  })
})
