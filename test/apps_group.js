const { assertInvalidOpcode } = require('./helpers/assertThrow')
const timetravel = require('./helpers/timer')
const { getBlock, getBlockNumber } = require('./helpers/web3')
const { encodeScript } = require('./helpers/evmScript')

const ExecutionTarget = artifacts.require('ExecutionTarget')
const Group = artifacts.require('Group')

contract('Group app', accounts => {
    let app = {}

    const member = accounts[1]
    const groupName = 'Test Group'

    beforeEach(async () => {
        app = await Group.new()
        await app.initialize(groupName)
    })

    it('has correct name context', async () => {
        assert.equal(await app.getName(), groupName, 'should have correct group name')
    })

    it('fails when forwarding non-member', async () => {
        return assertInvalidOpcode(async () => {
            await app.forward('0x00')
        })
    })

    it('fails when removing non-member', async () => {
        return assertInvalidOpcode(async () => {
            await app.removeMember('0x00')
        })
    })

    context('adding group member', () => {
        beforeEach(async () => {
            await app.addMember(member)
        })

        it('has been added', async () => {
            assert.isTrue(await app.isGroupMember(member), 'member should have been added')
        })

        it('fails if adding again', async () => {
            return assertInvalidOpcode(async () => {
                await app.addMember(member)
            })
        })
        
        it('can forward', async () => {
            const executionTarget = await ExecutionTarget.new()
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeScript([action])

            assert.isTrue(await app.canForward(member, script), 'member should be able to forward')
        })

        it('can be removed', async () => {
            await app.removeMember(member)
            assert.isFalse(await app.isGroupMember(member), 'member should have been removed')
        })

        it('forwards transactions', async () => {
            const executionTarget = await ExecutionTarget.new()
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeScript([action])

            await app.forward(script, { from: member })
            assert.equal(await executionTarget.counter(), 1, 'should have received execution call')
        })
    })
})
