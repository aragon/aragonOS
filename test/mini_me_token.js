const { getBlockNumber, getBlock, getBalance } = require('./helpers/web3')
const { assertRevert } = require('./helpers/assertThrow')
const MiniMeToken = artifacts.require('MiniMeToken')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')

contract('MiniMeToken', accounts => {
    const from = accounts[0]
    let factory = {}
    let token = {}
    let clone1 = {}
    let clone2 = {}

    it('should deploy contracts', async () => {
        factory = await MiniMeTokenFactory.new()
        token = await MiniMeToken.new(
            factory.address,
            0,
            0,
            'MiniMe Test Token',
            18,
            'MMT',
            true)

        assert.ok(token)
    })

    context('create, destroy, and claim tokens', () => {
        it('should generate tokens', async () => {
            await token.generateTokens(accounts[1], 100)
            assert.equal(await token.totalSupply(), 100, 'total supply generated should be 100')
            assert.equal(await token.balanceOf(accounts[1]), 100, 'accounts[1] balance should be 100')
        })

        it('should be able to destroy tokens', async() => {
            await token.destroyTokens(accounts[1], 20)

            let block = await getBlockNumber()

            assert.equal(await token.totalSupply(), 80, 'total supply should be at 80')
            assert.equal(await token.totalSupplyAt(block - 1), 100, 'total supply should be 100 in previous block')
            assert.equal(await token.balanceOf(accounts[1]), 80, 'should have destroyed 20 tokens from orignal amount')

            return assertRevert(async () => {
                await token.destroyTokens(accounts[2], 100)
            })
        })
    })

    context('test multi-transfer and disabling', () => {
        it('token should be able to transfer from account 1 to account 2', async () => {
            await token.transferFrom(accounts[1], accounts[2], 10)

            let block = await getBlockNumber()

            assert.equal(await token.totalSupply(), 80, 'total supply should still be at 80')
            assert.equal(await token.balanceOf(accounts[1]), 70, 'accounts[1] should have updated balance of 60')
            assert.equal(await token.balanceOf(accounts[2]), 10, 'accounts[2] should have a balance of 10')
            assert.equal(await token.balanceOfAt(accounts[1], block - 1), 80, 'accounts[1] balance should be 80 in previous block')
        })

        it('token should be able to transfer from account 2 to account 3', async () => {
            await token.transferFrom(accounts[2], accounts[3], 5)

            let block = await getBlockNumber()

            assert.equal(await token.totalSupply(), 80, 'total supply should still be at 80')
            assert.equal(await token.balanceOf(accounts[2]), 5, 'accounts[2] should have updated balance of 5')
            assert.equal(await token.balanceOf(accounts[3]), 5, 'accounts[3] should have a balance of 5')
            assert.equal(await token.balanceOfAt(accounts[2], block - 1), 10, 'accounts[2] balance should be 10 in previous block')
        })

        it('check transfer from controller', async () => {
            await token.transfer(accounts[2], 5)
            assert.equal(await token.balanceOf(accounts[2]), 5, 'accounts[2] should now have 10 tokens')

            assert.ok(await token.transfer(accounts[1], 0))
        })

        it('claim tokens', async () => {
            assert.ok(await token.claimTokens(0x0))
            assert.ok(await token.claimTokens(token.address))
            return assertRevert(async () => {
                await token.transfer(token.address, 5)
            })
        })

        it('disable transfers', async () => {
            token.enableTransfers(false)
            return assertRevert(async () => {
                await token.transfer(accounts[3], 5)
            })
        })

        it('approve tokens for spending', async () => {
            await token.enableTransfers(true)
            assert.ok(await token.approve(accounts[3], 10))
            assert.equal(await token.allowance(accounts[0], accounts[3]), 10, 'should have an allowance')
            await token.transferFrom(accounts[3], accounts[4], 5)
            let allowance = await token.allowance(accounts[0], accounts[3])

            assert.equal(allowance, 10, 'should now have an allowance of 5')

            await token.enableTransfers(false)
            return assertRevert(async () => {
                await token.approve(accounts[2], 10)
            })
        })
    })


    context('test all cloning', () => {
        it('should be able to clone token', async () => {
            clone1 = await MiniMeToken.new(await token.createCloneToken("MMT2", 18, "MMT2", 0, false))
            assert.equal(await clone1.totalSupply(), 0, 'should have 0 tokens')
        })

        it('generate some clone tokens', async () => {
            await clone1.generateTokens(accounts[0], 1000)

            let block = await getBlockNumber()

            assert.equal(await clone1.totalSupplyAt(block - 1), 0, 'previous supply should be 0 for cloned token')
            assert.equal(await clone1.balanceOfAt(accounts[0], block), 1000, 'cloned token controller should have balance of 1000')
            assert.equal(await clone1.balanceOfAt(accounts[0], block - 1), 0, 'cloned token controller should have previous balance of 0')
        })

        it('cloned token transfers', async() => {
            await clone1.transferFrom(accounts[0], accounts[1], 100)

            let block = await getBlockNumber()

            assert.equal(await clone1.balanceOf(accounts[0]), 900, 'clone token controller should only have 900 tokens after transfer')
            assert.equal(await clone1.balanceOfAt(accounts[0], block - 1), 1000, 'clone token controller should have 1000 in the past block')
            assert.equal(await clone1.balanceOf(accounts[1]), 100, 'transferee should now have 100 tokens')
        })
    })
})
