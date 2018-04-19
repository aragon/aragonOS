const namehash = require('eth-ens-namehash').hash
const keccak_256 = require('js-sha3').keccak_256

const getContract = name => artifacts.require(name)
const keccak256 = (name) => '0x' + keccak_256(name)

contract('Constants', accounts => {
  const coreString = 'core'
  const baseString = 'base'
  const appString = 'app'
  const apmNodeString = 'aragonpm.eth'
  const kernelString = 'kernel'
  const aclString = 'acl'

  it('checks kernel constants', async () => {
    const kernelConstants = await getContract('KernelConstants').new()
    console.log("ETH node: " + await kernelConstants.ETH_NODE())
    console.log("Apm node: " + await kernelConstants.APM_NODE())
    assert.equal(await kernelConstants.CORE_NAMESPACE(), keccak256(coreString), "core namespace doesn't match")
    assert.equal(await kernelConstants.APP_BASES_NAMESPACE(), keccak256(baseString), "base namespace doesn't match")
    assert.equal(await kernelConstants.APP_ADDR_NAMESPACE(), keccak256(appString), "app namespace doesn't match")

    assert.equal(await kernelConstants.KERNEL_APP_ID(), namehash(kernelString + '.' + apmNodeString), "kernel app id doesn't match")
    assert.equal(await kernelConstants.KERNEL_APP(), namehash(coreString + '.' + kernelString + '.' + apmNodeString), "kernel app doesn't match")

    assert.equal(await kernelConstants.ACL_APP_ID(), namehash(aclString + '.' + apmNodeString), "acl app id doesn't match")
    assert.equal(await kernelConstants.ACL_APP(), namehash(appString + '.' + aclString + '.' + apmNodeString), "acl app doesn't match")
  })

  it('checks ENS constants', async () => {
    const ethString = 'eth'
    const resolverString = 'resolver'

    const ensConstants = await getContract('ENSConstants').new()
    assert.equal(await ensConstants.ETH_TLD_LABEL(), keccak256(ethString), "ETH tld label doesn't match")
    assert.equal(await ensConstants.ETH_TLD_NODE(), namehash(ethString), "ETH tld node doesn't match")
    assert.equal(await ensConstants.PUBLIC_RESOLVER_LABEL(), keccak256(resolverString), "public resolver label doesn't match")
    assert.equal(await ensConstants.PUBLIC_RESOLVER_NODE(), namehash(resolverString + '.' + ethString), "public resolver node doesn't match")
  })
})
