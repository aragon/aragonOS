const Arbitrable = artifacts.require('ArbitrableMock')

contract('Arbitrable', () => {
  let arbitrable

  beforeEach('create arbitrable instance', async () => {
    arbitrable = await Arbitrable.new()
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      assert.isTrue(await arbitrable.supportsInterface('0x01ffc9a7'), 'does not support ERC165')
    })

    it('supports IArbitrable', async () => {
      assert.isTrue(await arbitrable.supportsInterface('0x88f3ee69'), 'does not support IArbitrable')
    })

    it('supports ERC165', async () => {
      assert.equal(await arbitrable.interfaceID(), await arbitrable.ARBITRABLE_INTERFACE(), 'IArbitrable interface ID does not match')
    })
  })
})
