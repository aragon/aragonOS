const { hash } = require('eth-ens-namehash')
const APMNamehashMock = artifacts.require('APMNamehashMock')

contract('APM Name Hash', () => {
  let apmNamehashMock

  before(async() => {
    apmNamehashMock = await APMNamehashMock.new()
  })

  const assertNamehash = async (name) => {
    const node = hash(name + '.aragonpm.eth')
    const apmNamehash = await apmNamehashMock.getAPMNamehash(name)
    assert.equal(node, apmNamehash.toString(), 'hashes do not match')
  }

  it('Kernel name hash matches', async () => {
    await assertNamehash('kernel')
  })

  it('ACL name hash matches', async () => {
    await assertNamehash('acl')
  })

  it('EVM Registry name hash matches', async () => {
    await assertNamehash('evmreg')
  })
})
