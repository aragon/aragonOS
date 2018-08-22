const { assertRevert } = require('./helpers/assertThrow')
const { getBlockNumber } = require('./helpers/web3')

// Mocks
const LifecycleMock = artifacts.require('LifecycleMock')

contract('Lifecycle', accounts => {
  let lifecycle

  beforeEach(async () => {
    lifecycle = await LifecycleMock.new()
  })

  it('is not initialized', async () => {
    assert.isFalse(await lifecycle.hasInitialized(), 'should not be initialized')
  })

  it('is not petrified', async () => {
    assert.isFalse(await lifecycle.isPetrified(), 'should not be petrified')
  })

  context('> Initialized', () => {
    beforeEach(async () => {
      await lifecycle.initializeMock()
    })

    it('is initialized', async () => {
      assert.isTrue(await lifecycle.hasInitialized(), 'should be initialized')
    })

    it('is not petrified', async () => {
      assert.isFalse(await lifecycle.isPetrified(), 'should not be petrified')
    })

    it('has correct initialization block', async () => {
      assert.equal(await lifecycle.getInitializationBlock(), await getBlockNumber(), 'initialization block should be correct')
    })
  })

  context('> Petrified', () => {
    beforeEach(async () => {
      await lifecycle.petrifyMock()
    })

    it('is not initialized', async () => {
      assert.isFalse(await lifecycle.hasInitialized(), 'should not be initialized')
    })

    it('is petrified', async () => {
      assert.isTrue(await lifecycle.isPetrified(), 'should be petrified')
    })

    it('has initialization block in the future', async () => {
      const petrifiedBlock = await lifecycle.getInitializationBlock()
      const blockNumber = await getBlockNumber()
      assert.isTrue(petrifiedBlock.greaterThan(blockNumber), 'petrified block should be in the future')
    })
  })
})
