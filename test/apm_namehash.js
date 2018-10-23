const namehash = require('eth-ens-namehash').hash
const APMNamehashMock = artifacts.require('APMNamehashMock')

contract('APM Name Hash', accounts => {
  let apmNamehashMock

  before(async() => {
    //console.log("eth: " + namehash('eth'))
    //console.log("aragonpm.eth: " + namehash('aragonpm.eth'))
    apmNamehashMock = await APMNamehashMock.new()
  })

  const checkName = async (name) => {
    const node = namehash(name + '.aragonpm.eth')
    //await apmNamehashMock.getAPMNamehash(name)
    const apmNamehash = await apmNamehashMock.getAPMNamehash(name)
    //console.log("node: " + node)
    return apmNamehash.toString() == node
  }

  it('Kernel name hash matches', async () => {
    assert.isTrue(await checkName('kernel'), 'hashes should match')
  })

  it('ACL name hash matches', async () => {
    assert.isTrue(await checkName('acl'), 'hashes should match')
  })

  it('EVM Registry name hash matches', async () => {
    assert.isTrue(await checkName('evmreg'), 'hashes should match')
  })
})
