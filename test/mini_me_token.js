const { getBlockNumber, getBlock } = require('./helpers/web3')
const MiniMeToken = artifacts.require('MiniMeToken')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')

contract('MiniMeToken', accounts => {
    let factory = {}
    let token = {}
    let clone1 = {}
    let clone2 = {}

    let baseBlock

    beforeEach(async () => {
        factory = await MiniMeTokenFactory.new()
        token = await MiniMeToken.new(
            factory.address,
            0,
            0,
            'MiniMe Test Token',
            18,
            'MMT',
            true,
        )
        await token.generateTokens(token.address, 100)
        await token.changeController(0xbeef)
        baseBlock = await getBlockNumber()
    })

    it('should have tokens', async () => {
        assert.equal(await token.balanceOf(token.address), 100)
    })

    it('should be able to clone token', async () => {
        clone1 = await MiniMeToken.new(await token.createCloneToken('MMT2',18,'MMT2',baseBlock,true))

        // await clone1.changeController(0xbeef)
        // assert.equal(await clone1.balanceOf(clone1.address), 100, 'should have tokens in cloned token')
        // assert.equal(await clone1.balanceOfAt(clone1.address), getBlockNumber() - 1, 100, 'should have correct balance beofre creating it')
    })

    // it('token should be able to transfer', async () => {
    //     await token.transfer(0x1, 10)
    //
    //     assert.equal(await token.balanceOf(token.address), 90, 'should have updated balance in token')
    //     assert.equal(await token.balanceOfAt(token.address), getBlockNumber() - 1, 100, 'should have previous balance in token')
    //     assert.equal(await clone1.balanceOf(clone1.address), 100, 'should have previous balance in cloned token')
    // })

    // it('should be able to clone token after a transfer', async () => {
    //     clone2 = await MiniMeToken(token.createCloneToken(
    //         "MMT3",
    //         18,
    //         "MMT3",
    //         getBlockNumber(),
    //         true
    //     ))
    //     await clone2.changeController(0xbeef); // so it doesn't ask this for callbacks
    //
    //     assert.equal(await clone2.balanceOf(clone2.address), 90, 'should have updated balance in token');
    //     assert.equal(await clone2.balanceOfAt(clone2.address), getBlockNumber() - 2, 100, 'should have previous balance in token');
    //
    //     await clone1.transfer(0x1, 10);
    //     assert.equal(await clone1.balanceOf(clone1.address), 90, 'should have updated balance in token');
    // })
    //
    // it('test that we are able to clone recurrently', async () => {
    //     let lastClone = clone1
    //     for (let i = 0; i < 10; i++) {
    //       lastClone = MiniMeToken(await lastClone.createCloneToken("MMTn", 18, "MMTn", getBlockNumber(), true))
    //     }
    //
    //     await lastClone.changeController(0xbeef) // so it doesn't ask this for callbacks
    //
    //     assert.equal(await lastClone.balanceOf(lastClone.address), 90, 'should have updated balance in token');
    //     assert.equal(await lastClone.balanceOfAt(lastClone.address), baseBlock, 100, 'should be able to travel back in time');
    // })

    // it('test multi-transfers', async () => {
    //
    // })
})
