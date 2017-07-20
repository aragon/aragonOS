const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var BylawsApp = artifacts.require('BylawsApp')
var OwnershipApp = artifacts.require('OwnershipApp')
var VotingApp = artifacts.require('mocks/VotingAppMock')
var StatusApp = artifacts.require('StatusApp')
var MiniMeToken = artifacts.require('MiniMeToken')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var VaultOrgan = artifacts.require('VaultOrgan')
var Vote = artifacts.require('Vote')
var BylawOracleMock = artifacts.require('mocks/BylawOracleMock')

var Kernel = artifacts.require('Kernel')

const { installOrgans, installApps } = require('./helpers/installer')
const { getBlockNumber } = require('./helpers/web3')

const createDAO = () => DAO.new(Kernel.address, { gas: 9e6 })

const zerothAddress = '0x'
const randomAddress = '0x0000000000000000000000000000000000001234'
const changeKernelSig = '0xcebe30ac'

contract('Bylaws', accounts => {
  let dao, metadao, kernel, bylawsApp, installedBylaws = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    await installOrgans(metadao, [MetaOrgan, VaultOrgan, ActionsOrgan])
    const apps = await installApps(metadao, [BylawsApp])
    installedBylaws = apps[0]

    bylawsApp = BylawsApp.at(dao.address)
    await metadao.setPermissionsOracle(installedBylaws.address)
  })

  it('bylaws are successfully installed', async () => {
    assert.equal(await kernel.getPermissionsOracle(), installedBylaws.address, 'should have set permissions oracle')
  })

  context('adding address bylaw', () => {
    beforeEach(async () => {
      await bylawsApp.setAddressBylaw(accounts[1], false, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
    })

    it('saved bylaw correctly', async () => {
      assert.equal(await bylawsApp.getBylawType(1), 3, 'bylaw type should be correct')
      assert.equal(await bylawsApp.getAddressBylaw(1), accounts[1], 'address should be correct')
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
      await bylawsApp.setAddressBylaw(oracle.address, true, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
    })

    it('saved bylaw correctly', async () => {
      assert.equal(await bylawsApp.getBylawType(1), 4, 'bylaw type should be correct')
      assert.equal(await bylawsApp.getAddressBylaw(1), oracle.address, 'address should be correct')
      assert.equal(await bylawsApp.getBylawNot(1), false, 'not should be correct')
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
      await bylawsApp.setAddressBylaw(accounts[1], false, true)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
    })

    it('saved bylaw correctly', async () => {
      assert.equal(await bylawsApp.getBylawType(1), 3, 'bylaw type should be correct')
      assert.equal(await bylawsApp.getAddressBylaw(1), accounts[1], 'address should be correct')
      assert.equal(await bylawsApp.getBylawNot(1), true, 'not should be correct')
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
    let votingApp, ownershipApp = {}
    let vote = {}

    const [holder20, holder31, holder49] = accounts
    const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))

    let currentBlock, startBlock, finalBlock = 0

    beforeEach(async () => {
      await installApps(metadao, [VotingApp, OwnershipApp])

      ownershipApp = OwnershipApp.at(dao.address)
      votingApp = VotingApp.at(dao.address)

      vote = await Vote.new()
      const voteBytecode = await votingApp.hashForCode(vote.address)
      await votingApp.setValidVoteCode(voteBytecode, true)

      await vote.instantiate(dao.address, metadao.replaceKernel.request(randomAddress).params[0].data)

      const token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await ownershipApp.addToken(token.address, 100, 1, 1, { gas: 1e6 })

      await ownershipApp.grantTokens(token.address, holder20, 20)
      await ownershipApp.grantTokens(token.address, holder31, 31)
      await ownershipApp.grantTokens(token.address, holder49, 49)

      currentBlock = await getBlockNumber()
      startBlock = currentBlock + 5
      finalBlock = currentBlock + 10
    })

    it('normal vote flow', async () => {
      await bylawsApp.setVotingBylaw(pct16(50), pct16(40), 5, 5, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1, { from: holder31 })
      await votingApp.voteNay(1, { from: holder20 })
      await votingApp.mock_setBlockNumber(finalBlock)

      await vote.execute()
      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')

      // TODO: Figure out why we were getting weird values when called through DAO
      assert.equal(await installedBylaws.getBylawType(1), 0, 'bylaw type should be correct')
      const [s, q, d, v] = await installedBylaws.getVotingBylaw(1)
      assert.equal(s.toNumber(), pct16(50).toNumber(), 'voting support should be correct')
      assert.equal(q.toNumber(), pct16(40).toNumber(), 'quorum should be correct')
      assert.equal(d, 5, 'voting debate should be correct')
      assert.equal(v, 5, 'voting time should be correct')
    })

    it('vote prematurely decided flow with vote yay and execute', async () => {
      await bylawsApp.setVotingBylaw(pct16(50), pct16(40), 5, 5, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.mock_setBlockNumber(finalBlock)
      await votingApp.voteYay(1, { from: holder31 })
      await votingApp.voteYayAndClose(1, { from: holder20 })

      assert.equal(await dao.getKernel(), randomAddress, 'Kernel should have been changed')
    })

    it('throws if voting hasnt been successful', async () => {
      await bylawsApp.setVotingBylaw(pct16(50), pct16(40), 5, 5, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteNay(1, { from: holder31 })
      await votingApp.voteYay(1, { from: holder20 })

      await votingApp.mock_setBlockNumber(finalBlock)

      try {
        await vote.execute()
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws if voting had no votes', async () => {
      await bylawsApp.setVotingBylaw(pct16(50), pct16(40), 5, 5, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(finalBlock)

      try {
        await vote.execute()
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws if voting didnt get enough quorum', async () => {
      await bylawsApp.setVotingBylaw(pct16(50), pct16(21), 5, 5, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1, { from: holder20 })

      await votingApp.mock_setBlockNumber(finalBlock)

      try {
        await vote.execute()
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws when attempting to execute action twice', async () => {
      await bylawsApp.setVotingBylaw(pct16(50), pct16(40), 5, 5, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1, { from: holder31 })
      await votingApp.voteNay(1, { from: holder20 })
      await votingApp.mock_setBlockNumber(finalBlock)

      await vote.execute()
      try {
        await vote.execute()
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })
  })

  context('adding token holder bylaw', () => {
    let ownershipApp = {}
    const holder1 = accounts[1]
    const holder2 = accounts[2]

    beforeEach(async () => {
      await installApps(metadao, [OwnershipApp])
      ownershipApp = OwnershipApp.at(dao.address)

      const token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token.changeController(dao.address)
      await ownershipApp.addToken(token.address, 100, 1, 1, { gas: 1e6 })

      const token2 = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
      await token2.changeController(dao.address)
      await ownershipApp.addToken(token2.address, 100, 1, 1, { gas: 1e6 })

      await ownershipApp.grantTokens(token.address, holder1, 10)
      await ownershipApp.grantTokens(token2.address, holder2, 1)

      await bylawsApp.setStatusBylaw(0, true, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
    })

    it('saved bylaw correctly', async () => {
      assert.equal(await bylawsApp.getBylawType(1), 2, 'bylaw type should be correct')
      assert.equal(await bylawsApp.getStatusBylaw(1), 0, 'address should be correct')
      assert.equal(await bylawsApp.getBylawNot(1), false, 'not should be correct')
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
    let statusApp = {}
    const authorized = accounts[3]
    const lowauth = accounts[4]
    const authLevel = 8
    beforeEach(async () => {
      await installApps(metadao, [StatusApp])

      statusApp = StatusApp.at(dao.address)

      await statusApp.setEntityStatus(authorized, authLevel)
      await statusApp.setEntityStatus(lowauth, authLevel - 1)
      await bylawsApp.setStatusBylaw(authLevel, false, false)
      await bylawsApp.linkBylaw(changeKernelSig, 1)
    })

    it('saved bylaw correctly', async () => {
      assert.equal(await bylawsApp.getBylawType(1), 1, 'bylaw type should be correct')
      assert.equal(await bylawsApp.getStatusBylaw(1), authLevel, 'status should be correct')
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

      await bylawsApp.setAddressBylaw(allowedAddress, false, false)
      await bylawsApp.setAddressBylaw(oracle.address, true, false)
    })

    const addressBylaw = 1
    const oracleBylaw = 2

    context('adding OR bylaw', () => {
      beforeEach(async () => {
        await bylawsApp.setCombinatorBylaw(0, addressBylaw, oracleBylaw, false)
        await bylawsApp.linkBylaw(changeKernelSig, 3)
      })

      it('saved bylaw correctly', async () => {
        assert.equal(await bylawsApp.getBylawType(3), 5, 'bylaw type should be correct')
        const [t, l, r] = await bylawsApp.getCombinatorBylaw(3)
        assert.equal(t, 0, 'comb type should be correct')
        assert.equal(l, addressBylaw, 'comb type should be correct')
        assert.equal(r, oracleBylaw, 'comb type should be correct')
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
        await bylawsApp.setCombinatorBylaw(1, addressBylaw, oracleBylaw, false)
        await bylawsApp.linkBylaw(changeKernelSig, 3)
      })

      it('saved bylaw correctly', async () => {
        assert.equal(await bylawsApp.getBylawType(3), 5, 'bylaw type should be correct')
        const [t, l, r] = await bylawsApp.getCombinatorBylaw(3)
        assert.equal(t, 1, 'comb type should be correct')
        assert.equal(l, addressBylaw, 'comb type should be correct')
        assert.equal(r, oracleBylaw, 'comb type should be correct')
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
        await bylawsApp.setCombinatorBylaw(2, addressBylaw, oracleBylaw, false)
        await bylawsApp.linkBylaw(changeKernelSig, 3)
      })

      it('saved bylaw correctly', async () => {
        assert.equal(await bylawsApp.getBylawType(3), 5, 'bylaw type should be correct')
        const [t, l, r] = await bylawsApp.getCombinatorBylaw(3)
        assert.equal(t, 2, 'comb type should be correct')
        assert.equal(l, addressBylaw, 'comb type should be correct')
        assert.equal(r, oracleBylaw, 'comb type should be correct')      })

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
