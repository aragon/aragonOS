const assertThrow = require('./helpers/assertThrow');
var DAO = artifacts.require('DAO');
var MetaOrgan = artifacts.require('MetaOrgan')
var ActionsOrgan = artifacts.require('ActionsOrgan')
var OwnershipApp = artifacts.require('OwnershipApp')
var MiniMeToken = artifacts.require('MiniMeIrrevocableVestedToken')
var Controller = artifacts.require('Controller')
var VotingApp = artifacts.require('./mocks/VotingAppMock')
var Vote = artifacts.require('Vote')

var Kernel = artifacts.require('Kernel')

const { getBlockNumber } = require('./helpers/web3')
const { installOrgans, installApps } = require('./helpers/installer')

const createDAO = () => DAO.new(Kernel.address)

const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))

const states = {
  debate: 0,
  voting: 1,
  closed: 2,
}

contract('VotingApp', accounts => {
  let dao, metadao, kernel, appOrgan, ownershipApp, votingApp, token, vote = {}

  beforeEach(async () => {
    dao = await createDAO()
    metadao = MetaOrgan.at(dao.address)
    kernel = Kernel.at(dao.address)

    ownershipApp = OwnershipApp.at(dao.address)
    votingApp = VotingApp.at(dao.address)

    await installOrgans(metadao, [MetaOrgan, ActionsOrgan])
    await installApps(metadao, [VotingApp, OwnershipApp])

    vote = await Vote.new()
    const voteBytecode = await votingApp.hashForCode(vote.address)
    await votingApp.setValidVoteCode(voteBytecode, true)

    token = await MiniMeToken.new('0x0', '0x0', 0, 'hola', 18, '', true)
    await token.changeController(dao.address)
    await ownershipApp.addToken(token.address, 1000, 1, 1)
    await ownershipApp.grantTokens(token.address, accounts[0], 30)
    await ownershipApp.grantTokens(token.address, accounts[1], 35)
  })

  context('creating basic voting', () => {
    let currentBlock, startBlock, finalBlock = 0

    it('throws when vote bytecode is not valid', async () => {
      try {
        await votingApp.createVote(dao.address, startBlock, finalBlock, pct16(50))
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('throws when vote address is a normal account', async () => {
      try {
        await votingApp.createVote(accounts[1], startBlock, finalBlock, pct16(50))
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    beforeEach(async () => {
      currentBlock = await getBlockNumber()
      startBlock = currentBlock + 5
      finalBlock = currentBlock + 10
      await votingApp.mock_setBlockNumber(currentBlock)
      await votingApp.createVote(vote.address, startBlock, finalBlock, pct16(50))
    })

    it('has correct initial state', async () => {
      const [state, voteCreator, voteAddress, voteCreatedBlock, voteStartsBlock, voteEndsBlock] = await votingApp.getVoteStatus(1)
      assert.equal(state, states.debate, 'state should be debate')
      assert.equal(voteCreator, accounts[0], 'vote creator should be sender')
    })

    it('throws when voting on debate', async () => {
      try {
        await votingApp.voteYay(1)
      } catch (error) {
        return assertThrow(error)
      }
      assert.fail('should have thrown before')
    })

    it('voting on voting time does a state transition and votes', async () => {
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1, { from: accounts[0] })
      await votingApp.voteNay(1, { from: accounts[1] })

      const [state, voteCreator, voteAddress, voteCreatedBlock, voteStartsBlock, voteEndsBlock, yays, nays, totalQuorum] = await votingApp.getVoteStatus(1)
      assert.equal(state, states.voting, 'state should be voting')
      assert.equal(yays, 30, 'yay votes should have been added')
      assert.equal(nays, 35, 'nay votes should have been added')

      assert.equal(totalQuorum, 65, 'quorum should be assigned tokens')
    })

    it('re-voting modifies vote', async () => {
      await votingApp.mock_setBlockNumber(startBlock)
      await votingApp.voteYay(1)
      await votingApp.voteNay(1)
      const [state, voteCreator, voteAddress, voteCreatedBlock, voteStartsBlock, voteEndsBlock, yays, nays] = await votingApp.getVoteStatus(1)

      assert.equal(yays, 0, 'yay votes should have been modified')
      assert.equal(nays, 30, 'nay votes should have been modified')
      assert.equal(state, states.voting, 'state should be voting')
    })

    it('closes voting after final block', async () => {
      await votingApp.mock_setBlockNumber(finalBlock + 1)
      await votingApp.transitionStateIfChanged(1)

      const [state] = await votingApp.getVoteStatus(1)
      assert.equal(state, states.closed, 'state should be closed')
    })
  })
})
