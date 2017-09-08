const sha3 = require('solidity-sha3').default

const { assertInvalidOpcode } = require('./helpers/assertThrow')
const { getBlockNumber } = require('./helpers/web3')
const timetravel = require('./helpers/timer')

const VotingApp = artifacts.require('VotingApp')
const MiniMeToken = artifacts.require('MiniMeToken')

const ExecutionTarget = artifacts.require('ExecutionTarget')

const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))
const createdVoteId = receipt => receipt.logs.filter(x => x.event == 'StartVote')[0].args.votingId

contract('Voting App', accounts => {
    let app, token, executionTarget = {}

    const votingTime = 1000

    const holder19 = accounts[0]
    const holder31 = accounts[1]
    const holder50 = accounts[2]
    const nonHolder = accounts[4]

    beforeEach(async () => {
        const n = '0x00'
        token = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true)

        await token.generateTokens(holder19, 19)
        await token.generateTokens(holder31, 31)
        await token.generateTokens(holder50, 50)

        app = await VotingApp.new()
        await app.initialize(token.address, pct16(50), pct16(20), votingTime)

        executionTarget = await ExecutionTarget.new()
    })

    it('deciding voting is automatically executed', async () => {
        const script = await app.makeSingleScript(executionTarget.address, executionTarget.contract.execute.getData())
        const votingId = createdVoteId(await app.newVoting(script, { from: holder50 }))
        assert.equal(await executionTarget.counter(), 1, 'should have received execution call')
    })

    it('execution scripts can execute multiple actions', async () => {
        let script = await app.makeSingleScript(executionTarget.address, executionTarget.contract.execute.getData())
        script = script + script.slice(2) + script.slice(2)
        const votingId = createdVoteId(await app.newVoting(script, { from: holder50 }))
        assert.equal(await executionTarget.counter(), 3, 'should have executed multiple times')
    })

    it('execution throws if any action on script throws', async () => {
        let script = await app.makeSingleScript(executionTarget.address, executionTarget.contract.execute.getData())
        script = script.slice(0, -2) // remove one byte from calldata for it to fail
        return assertInvalidOpcode(async () => {
            await app.newVoting(script, { from: holder50 })
        })
    })

    context('creating vote', () => {
        let voteId = {}
        let script = ''

        beforeEach(async () => {
            script = await app.makeSingleScript(executionTarget.address, executionTarget.contract.execute.getData())
            script = script + script.slice(2)
            voteId = createdVoteId(await app.newVoting(script, { from: nonHolder }))
        })

        it('has correct state', async () => {
            const [isOpen, isExecuted, creator, startDate, snapshotBlock, y, n, totalVoters, scriptHash, scriptActionsCount] = await app.getVoting(voteId)

            assert.isTrue(isOpen, 'vote should be open')
            assert.isFalse(isExecuted, 'vote should be executed')
            assert.equal(creator, nonHolder, 'creator should be correct')
            assert.equal(snapshotBlock, await getBlockNumber() - 1, 'snapshot block should be correct')
            assert.equal(y, 0, 'initial yea should be 0')
            assert.equal(n, 0, 'initial nay should be 0')
            assert.equal(totalVoters, 100, 'total voters should be 100')
            assert.equal(scriptHash, sha3(script), 'script hash should be correct')
            assert.equal(scriptActionsCount, 2)
        })

        it('has correct script actions', async () => {
            const [addr, calldata] = await app.getVotingScriptAction(voteId, 1)

            assert.equal(addr, executionTarget.address, 'execution addr should match')
            assert.equal(calldata, executionTarget.contract.execute.getData(), 'calldata should match')
        })

        it('holder can vote', async () => {
            await app.vote(voteId, false, { from: holder31 })
            const state = await app.getVoting(voteId)

            assert.equal(state[6], 31, 'nay vote should have been counted')
        })

        it('holder can modify vote', async () => {
            await app.vote(voteId, true, { from: holder31 })
            await app.vote(voteId, false, { from: holder31 })
            await app.vote(voteId, true, { from: holder31 })
            const state = await app.getVoting(voteId)

            assert.equal(state[5], 31, 'yea vote should have been counted')
            assert.equal(state[6], 0, 'nay vote should have been removed')
        })

        it('token transfers dont affect voting', async () => {
            await token.transfer(nonHolder, 31, { from: holder31 })

            await app.vote(voteId, true, { from: holder31 })
            const state = await app.getVoting(voteId)

            assert.equal(state[5], 31, 'yea vote should have been counted')
            assert.equal(await token.balanceOf(holder31), 0, 'balance should be 0 at current block')
        })

        it('throws when non-holder votes', async () => {
            return assertInvalidOpcode(async () => {
                await app.vote(voteId, true, { from: nonHolder })
            })
        })

        it('throws when voting after voting closes', async () => {
            await timetravel(votingTime + 1)
            return assertInvalidOpcode(async () => {
                await app.vote(voteId, true, { from: holder31 })
            })
        })

        it('can execute if vote is approved with support and quorum', async () => {
            await app.vote(voteId, true, { from: holder31 })
            await app.vote(voteId, false, { from: holder19 })
            await timetravel(votingTime + 1)
            await app.executeVote(voteId)
            assert.equal(await executionTarget.counter(), 2, 'should have executed result')
        })

        it('cannot execute vote if not enough quorum met', async () => {
            await app.vote(voteId, true, { from: holder19 })
            await timetravel(votingTime + 1)
            return assertInvalidOpcode(async () => {
                await app.executeVote(voteId)
            })
        })

        it('vote is executed automatically if decided', async () => {
            await app.vote(voteId, true, { from: holder50 }) // causes execution
            assert.equal(await executionTarget.counter(), 2, 'should have executed result')
        })

        it('cannot re-execute vote', async () => {
            await app.vote(voteId, true, { from: holder50 }) // causes execution
            return assertInvalidOpcode(async () => {
                await app.executeVote(voteId)
            })
        })

        it('cannot vote on executed vote', async () => {
            await app.vote(voteId, true, { from: holder50 }) // causes execution
            return assertInvalidOpcode(async () => {
                await app.vote(voteId, true, { from: holder19 })
            })
        })
    })
})
