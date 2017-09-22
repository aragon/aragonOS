const { assertInvalidOpcode } = require('./helpers/assertThrow')
const timetravel = require('./helpers/timer')
const { getBlock, getBlockNumber } = require('./helpers/web3')
const { encodeScript } = require('./helpers/evmScript')

const ExecutionTarget = artifacts.require('ExecutionTarget')
const GroupApp = artifacts.require('GroupApp')

contract('Group app', accounts => {
    let app = {}

    const member = accounts[1]
    const groupContext = 'Test Group'

    beforeEach(async () => {
        app = await GroupApp.new()
        await app.initialize(groupContext)
    })

    it('has correct name context', async () => {
        assert.equal(await app.getContext(), groupContext, 'should have correct group context')
    })

    it('fails when forwarding non-member', async () => {
        return assertInvalidOpcode(async () => {
            await app.forward('0x00')
        })
    })

    context('adding group member', () => {
        beforeEach(async () => {
            await app.addMember(member)
        })

        it('has been added', async () => {
            assert.isTrue(await app.isMember(member), 'member should have been added')
        })

        it('fails if adding again', async () => {
            return assertInvalidOpcode(async () => {
                await app.addMember(member)
            })
        })

        it('can be removed', async () => {
            await app.removeMember(member)
            assert.isFalse(await app.isMember(member), 'member should have been removed')
        })

        it('is allowed to forward', async () => {
            const executionTarget = await ExecutionTarget.new()
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeScript([action])

            await app.forward(script, { from: member })
            assert.equal(await executionTarget.counter(), 1, 'should have received execution call')
        })
    })
})
