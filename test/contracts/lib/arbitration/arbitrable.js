const ArbitrableMock = artifacts.require('ArbitrableMock')
const ERC165Mock = artifacts.require('ERC165Mock')

contract('Arbitrable', () => {
  let arbitrable

  const ARBITRABLE_INTERFACE = '0x88f3ee69'
  const ERC165_INTERFACE = '0x01ffc9a7'

  before('create arbitrable instance', async () => {
    arbitrable = await ArbitrableMock.new()
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      const erc165 = await ERC165Mock.new()
      assert.isTrue(await arbitrable.supportsInterface(ERC165_INTERFACE), 'does not support ERC165')

      assert.equal(await erc165.interfaceID(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
      assert.equal(await erc165.ERC165_INTERFACE(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
    })

    it('supports IArbitrable', async () => {
      assert.isTrue(await arbitrable.supportsInterface(ARBITRABLE_INTERFACE), 'does not support IArbitrable')

      assert.equal(await arbitrable.ARBITRABLE_INTERFACE(), ARBITRABLE_INTERFACE, 'IArbitrable interface ID does not match')
      assert.equal(await arbitrable.interfaceID(), await arbitrable.ARBITRABLE_INTERFACE(), 'IArbitrable interface ID does not match')
    })

    it('does not support 0xffffffff', async () => {
      assert.isFalse(await arbitrable.supportsInterface('0xffffffff'), 'should not support 0xffffffff')
    })
  })
})
