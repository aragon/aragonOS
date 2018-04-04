const namehash = require('eth-ens-namehash').hash
const APMNamehashWrapper = artifacts.require('APMNamehashWrapper')

contract('APM Name Hash', accounts => {
  let apmNamehashWrapper

  before(async() => {
    //console.log("eth: " + namehash('eth'))
    //console.log("aragonpm.eth: " + namehash('aragonpm.eth'))
    apmNamehashWrapper = await APMNamehashWrapper.new()
  })

  const checkName = async (name) => {
    const node = namehash(name + '.aragonpm.eth')
    //await apmNamehashWrapper.getAPMNamehash(name)
    const apmNamehash = await apmNamehashWrapper.getAPMNamehash.call(name)
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
