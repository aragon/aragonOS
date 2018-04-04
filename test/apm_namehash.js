const namehash = require('eth-ens-namehash').hash
const APMNameHashWrapper = artifacts.require('APMNameHashWrapper')

contract('APM Name Hash', accounts => {
  let apmNameHashWrapper

  before(async() => {
    //console.log("eth: " + namehash('eth'))
    //console.log("aragonpm.eth: " + namehash('aragonpm.eth'))
    apmNameHashWrapper = await APMNameHashWrapper.new()
  })

  const checkName = async (name) => {
    const node = namehash(name + '.aragonpm.eth')
    //await apmNameHashWrapper.getAPMNameHash(name)
    const apmNameHash = await apmNameHashWrapper.getAPMNameHash.call(name)
    //console.log("node: " + node)
    return apmNameHash.toString() == node
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
