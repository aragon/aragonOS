const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ApplicationOrgan = artifacts.require('ApplicationOrgan')
var BylawsApp = artifacts.require('mocks/BylawsAppMock')
var OwnershipApp = artifacts.require('OwnershipApp')
var VotingApp = artifacts.require('mocks/VotingAppMock')
var StatusApp = artifacts.require('StatusApp')
var MiniMeToken = artifacts.require('MiniMeToken')
var TokensOrgan = artifacts.require('TokensOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var BylawOracleMock = artifacts.require('mocks/BylawOracleMock')

var Kernel = artifacts.require('Kernel')

const { getBlockNumber } = require('./helpers/web3')

const createDAO = () => DAO.new({ gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'
const changeKernelSig = '0xcebe30ac'

contract('Bylaws', accounts => {
  let dao, metadao, kernel, appOrgan, bylawsApp, dao_bylawsApp = {}

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

    bylawsApp = await BylawsApp.new(dao.address)
    dao_bylawsApp = BylawsApp.at(dao.address)

    await appOrgan.installApp(1, bylawsApp.address)
    await metadao.setPermissionsOracle(bylawsApp.address)
  })

  it('bylaws are successfully installed', async () => {
    assert.equal(await kernel.getPermissionsOracle(), bylawsApp.address, 'should have set permissions oracle')
    assert.equal(await appOrgan.getApp(1), bylawsApp.address, 'should have returned installed app addr')
  })

  context('adding address bylaw', () => {
    beforeEach(async () => {
      await dao_bylawsApp.setAddressBylaw(changeKernelSig, accounts[1], false, false)
    })

    it('allows action by specified address', async () => {
      await metadao.replaceKernel(randomAddress, { from: accounts[1] })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when not authorized address does action', async () => {
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[2] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding oracle bylaw', () => {
    let oracle = {}
    beforeEach(async () => {
      oracle = await BylawOracleMock.new()
      await dao_bylawsApp.setAddressBylaw(changeKernelSig, oracle.address, true, false)
    })

    it('allows action when oracle is enabled', async () => {
      await oracle.changeAllow(true)
      await metadao.replaceKernel(randomAddress, { from: accounts[1] })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when oracle is disabled and does action', async () => {
      await oracle.changeAllow(false)
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[2] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding negated address bylaw', () => {
    beforeEach(async () => {
      await dao_bylawsApp.setAddressBylaw(changeKernelSig, accounts[1], false, true)
    })

    it('allows action by any other than specified address', async () => {
      await metadao.replaceKernel(randomAddress, { from: accounts[2] })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when authorized address does action', async () => {
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[1] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding voting bylaw', () => {
    let votingApp, dao_votingApp = {}
    let ownershipApp, dao_ownershipApp = {}

    const voteAddress = accounts[8]
    const [holder20, holder31, holder49] = accounts
    const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))

    let currentBlock, startBlock, finalBlock = 0

    beforeEach(async () => {
      ownershipApp = await OwnershipApp.new(dao.address)
      dao_ownershipApp = OwnershipApp.at(dao.address)

      await appOrgan.installApp(2, ownershipApp.address)

      votingApp = await VotingApp.new(dao.address)
      dao_votingApp = VotingApp.at(dao.address)

      await appOrgan.installApp(3, votingApp.address)

      const token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await dao_ownershipApp.addOrgToken(token.address, 100, 1, 1, { gas: 1e6 })

      await dao_ownershipApp.grantTokens(0, 20, holder20)
      await dao_ownershipApp.grantTokens(0, 31, holder31)
      await dao_ownershipApp.grantTokens(0, 49, holder49)

      currentBlock = await getBlockNumber()
      startBlock = currentBlock + 5
      finalBlock = currentBlock + 10
    })

    it('normal vote flow', async () => {
      await dao_bylawsApp.setVotingBylaw(changeKernelSig, pct16(50), pct16(40), 5, 5, false)
      await dao_votingApp.createVote(voteAddress, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1, { from: holder31 })
      await votingApp.voteNay(1, { from: holder20 })
      await bylawsApp.mock_setBlockNumber(finalBlock)

      await metadao.replaceKernel(randomAddress, { from: voteAddress })
      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('vote prematurely decided flow', async () => {
      await dao_bylawsApp.setVotingBylaw(changeKernelSig, pct16(50), pct16(40), 5, 5, false)
      await dao_votingApp.createVote(voteAddress, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.mock_setBlockNumber(finalBlock)
      await votingApp.voteYay(1, { from: holder31 })
      await votingApp.voteYay(1, { from: holder20 })

      await metadao.replaceKernel(randomAddress, { from: voteAddress })
      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws if voting hasnt been successful', async () => {
      await dao_bylawsApp.setVotingBylaw(changeKernelSig, pct16(50), pct16(40), 5, 5, false)
      await dao_votingApp.createVote(voteAddress, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteNay(1, { from: holder31 })
      await votingApp.voteYay(1, { from: holder20 })

      await bylawsApp.mock_setBlockNumber(finalBlock)

      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[0] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws if voting didnt get enough quorum', async () => {
      await dao_bylawsApp.setVotingBylaw(changeKernelSig, pct16(50), pct16(21), 5, 5, false)
      await dao_votingApp.createVote(voteAddress, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1, { from: holder20 })

      await bylawsApp.mock_setBlockNumber(finalBlock)

      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[0] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding token holder bylaw', () => {
    let ownershipApp, dao_ownershipApp = {}
    const holder1 = accounts[1]
    const holder2 = accounts[2]

    beforeEach(async () => {
      ownershipApp = await OwnershipApp.new(dao.address)
      dao_ownershipApp = OwnershipApp.at(dao.address)

      await appOrgan.installApp(2, ownershipApp.address)

      const token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await dao_ownershipApp.addOrgToken(token.address, 100, 1, 1, { gas: 1e6 })

      const token2 = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token2.changeController(dao.address)
      await dao_ownershipApp.addOrgToken(token2.address, 100, 1, 1, { gas: 1e6 })

      await dao_ownershipApp.grantTokens(0, 10, holder1)
      await dao_ownershipApp.grantTokens(1, 1, holder2)

      await dao_bylawsApp.setStatusBylaw(changeKernelSig, 0, true, false)
    })

    it('allows action by holder 1', async () => {
      await metadao.replaceKernel(randomAddress, { from: holder1 })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('allows action by holder 2', async () => {
      await metadao.replaceKernel(randomAddress, { from: holder2 })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when another address does action', async () => {
      try {
        await metadao.replaceKernel(randomAddress, { from: accounts[0] })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding status bylaw', () => {
    let statusApp, dao_statusApp = {}
    const authorized = accounts[3]
    const lowauth = accounts[4]
    beforeEach(async () => {
      statusApp = await StatusApp.new(dao.address)
      dao_statusApp = StatusApp.at(dao.address)

      await appOrgan.installApp(2, statusApp.address)

      const authLevel = 8
      await dao_statusApp.setEntityStatus(authorized, authLevel)
      await dao_statusApp.setEntityStatus(lowauth, authLevel - 1)
      await dao_bylawsApp.setStatusBylaw(changeKernelSig, authLevel, false, false)
    })

    it('allows action by entity with status', async () => {
      await metadao.replaceKernel(randomAddress, { from: authorized })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws when done by entity without status', async () => {
      try {
        await metadao.replaceKernel(randomAddress, { from: lowauth })
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding combinable bylaws', () => {
    const allowedAddress = accounts[2]
    let oracle = {}
    beforeEach(async () => {
      oracle = await BylawOracleMock.new()

      await dao_bylawsApp.setAddressBylaw('0x00', allowedAddress, false, false)
      await dao_bylawsApp.setAddressBylaw('0x00', oracle.address, true, false)
    })

    const addressBylaw = 1
    const oracleBylaw = 2

    context('adding OR bylaw', () => {
      beforeEach(async () => {
        await dao_bylawsApp.setCombinatorBylaw(changeKernelSig, 0, addressBylaw, oracleBylaw, false)
      })

      it('allows action if address is correct', async () => {
        await metadao.replaceKernel(randomAddress, { from: allowedAddress })
        assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
      })

      it('allows action if oracle allows is correct', async () => {
        await oracle.changeAllow(true)
        await metadao.replaceKernel(randomAddress, { from: accounts[8] })
        assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
      })

      it('allows action if both are true', async () => {
        await oracle.changeAllow(true)
        await metadao.replaceKernel(randomAddress, { from: allowedAddress })
        assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
      })

      it('throws when both fail', async () => {
        try {
          await metadao.replaceKernel(randomAddress, { from: accounts[8] })
        } catch (error) {
          return assertThrow(error)
        }
      })
    })

    context('adding AND bylaw', () => {
      beforeEach(async () => {
        await dao_bylawsApp.setCombinatorBylaw(changeKernelSig, 1, addressBylaw, oracleBylaw, false)
      })

      it('allows action if both are true', async () => {
        await oracle.changeAllow(true)
        await metadao.replaceKernel(randomAddress, { from: allowedAddress })
        assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
      })

      it('throws when first fails', async () => {
        await oracle.changeAllow(true)
        try {
          await metadao.replaceKernel(randomAddress, { from: accounts[8] })
        } catch (error) {
          return assertThrow(error)
        }
      })

      it('throws when first fails', async () => {
        await oracle.changeAllow(false)
        try {
          await metadao.replaceKernel(randomAddress, { from: allowedAddress })
        } catch (error) {
          return assertThrow(error)
        }
      })
    })

    context('adding XOR bylaw', () => {
      beforeEach(async () => {
        await dao_bylawsApp.setCombinatorBylaw(changeKernelSig, 2, addressBylaw, oracleBylaw, false)
      })

      it('allows when only first allows', async () => {
        await oracle.changeAllow(false)
        await metadao.replaceKernel(randomAddress, { from: allowedAddress })
        assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
      })

      it('allows when only second allows', async () => {
        await oracle.changeAllow(true)
        await metadao.replaceKernel(randomAddress, { from: accounts[8] })
        assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
      })

      it('throws if both are false', async () => {
        await oracle.changeAllow(false)
        try {
          await metadao.replaceKernel(randomAddress, { from: accounts[8] })
        } catch (error) {
          return assertThrow(error)
        }
      })

      it('throws if both are true', async () => {
        await oracle.changeAllow(true)
        try {
          await metadao.replaceKernel(randomAddress, { from: allowedAddress })
        } catch (error) {
          return assertThrow(error)
        }
      })
    })
  })
})
