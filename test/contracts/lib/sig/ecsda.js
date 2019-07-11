const { sha3, soliditySha3 } = require('web3-utils')

const ECDSA = artifacts.require('ECDSAMock')

contract('ECDSA', ([_, someone]) => {
  let ecdsa, signature

  const MESSAGE = soliditySha3(sha3('0x11111'), 1000)

  before(async () => {
    ecdsa = await ECDSA.new()
    signature = await web3.eth.sign(someone, MESSAGE)
  })

  context('with correct signature', () => {
    it('returns the signer address', async () => {
      assert.equal(await ecdsa.recover(MESSAGE, signature), someone)
    })
  })

  context('with wrong signature', () => {
    it('does not return the signer address', async () => {
      assert.notEqual(await ecdsa.recover('0xdead', signature), someone)
    })
  })
})
