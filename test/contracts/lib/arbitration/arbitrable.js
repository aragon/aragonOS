const Arbitrable = artifacts.require('ArbitrableMock')

contract('Arbitrable', () => {
  let arbitrable

  beforeEach('create arbitrable instance', async () => {
    arbitrable = await Arbitrable.new()
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      assert.isTrue(await arbitrable.supportsInterface('0x01ffc9a7'), 'does not support ERC165')

      assert.equal(await arbitrable.ERC165_INTERFACE(), '0x01ffc9a7', 'ERC165 interface ID does not match')
      assert.equal(await arbitrable.erc165interfaceID(), await arbitrable.ERC165_INTERFACE(), 'ERC165 interface ID does not match')
    })

    it('supports IArbitrable', async () => {
      assert.isTrue(await arbitrable.supportsInterface('0x88f3ee69'), 'does not support IArbitrable')

      assert.equal(await arbitrable.ARBITRABLE_INTERFACE(), '0x88f3ee69', 'IArbitrable interface ID does not match')
      assert.equal(await arbitrable.interfaceID(), await arbitrable.ARBITRABLE_INTERFACE(), 'IArbitrable interface ID does not match')
    })

    it('does not support 0xffffffff', async () => {
      assert.isFalse(await arbitrable.supportsInterface('0xffffffff'), 'should not support 0xffffffff')
    })
  })
})
