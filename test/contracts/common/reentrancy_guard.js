const { assertRevert } = require('../../helpers/assertThrow')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract('ReentrancyGuard', () => {
  let reentrancyMock

  async function assertReentrancyMutex(mutex, msg) {
    assert.equal(
      await web3.eth.getStorageAt(reentrancyMock.address, (await reentrancyMock.getReentrancyMutexPosition())),
      mutex,
      msg
    )
  }

  beforeEach(async () => {
    reentrancyMock = await artifacts.require('ReentrancyGuardMock').new()
  })

  it('starts with false mutex', async () => {
    await assertReentrancyMutex(false, 're-entrancy mutex should start false')
  })

  it('starts with no calls', async () => {
    assert.equal((await reentrancyMock.callCounter()).toString(), 0, 'should start with no calls')
  })

  it('can call re-entrant function normally', async () => {
    await reentrancyMock.reentrantCall(ZERO_ADDR)
    assert.equal((await reentrancyMock.callCounter()).toString(), 1, 'should have registered one call')
    await assertReentrancyMutex(false, 're-entrancy mutex should end false')
  })

  it('can call non-re-entrant function normally', async () => {
    await reentrancyMock.nonReentrantCall(ZERO_ADDR)
    assert.equal((await reentrancyMock.callCounter()).toString(), 1, 'should have registered one call')
    await assertReentrancyMutex(false, 're-entrancy mutex should end false')
  })

  context('> Enabled re-entrancy mutex', () => {
    beforeEach(async () => {
      // Manually set re-entrancy mutex
      await reentrancyMock.setReentrancyMutex(true)
    })

    it('can call re-entrant function if re-entrancy mutex is enabled', async () => {
      await reentrancyMock.reentrantCall(ZERO_ADDR)
      assert.equal((await reentrancyMock.callCounter()).toString(), 1, 'should have called')
    })

    it('can not call non-re-entrant function if re-entrancy mutex is enabled', async () => {
      await assertRevert(reentrancyMock.nonReentrantCall(ZERO_ADDR))
      assert.equal((await reentrancyMock.callCounter()).toString(), 0, 'should not have called')
    })
  })

  context('> Re-entering through contract', async () => {
    let reentrantActor

    afterEach(async () => {
      await assertReentrancyMutex(false, 're-entrancy mutex should end false')
    })

    context('> Re-enters re-entrant call', async () => {
      before(async () => {
        reentrantActor = await artifacts.require('ReentrantActor').new(false)
      })

      it('allows re-entering re-entrant call', async () => {
        await reentrancyMock.reentrantCall(reentrantActor.address)
        assert.equal((await reentrancyMock.callCounter()).toString(), 2, 'should have called twice')
      })

      it('allows entering non-re-entrant call from re-entrant call', async () => {
        await reentrancyMock.nonReentrantCall(reentrantActor.address)
        assert.equal((await reentrancyMock.callCounter()).toString(), 2, 'should have called twice')
      })
    })

    context('> Re-enters non-reentrant call', async () => {
      before(async () => {
        reentrantActor = await artifacts.require('ReentrantActor').new(true)
      })

      it('disallows re-entering non-re-entrant call', async () => {
        await assertRevert(reentrancyMock.nonReentrantCall(reentrantActor.address))
        assert.equal((await reentrancyMock.callCounter()).toString(), 0, 'should not have completed any calls')
      })

      it('allows entering non-entrant call from re-entrant call', async () => {
        await reentrancyMock.reentrantCall(reentrantActor.address)
        assert.equal((await reentrancyMock.callCounter()).toString(), 2, 'should have called twice')
      })
    })
  })
})
