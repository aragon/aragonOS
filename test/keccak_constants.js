const namehash = require('eth-ens-namehash').hash
const keccak_256 = require('js-sha3').keccak_256

const getContract = name => artifacts.require(name)
const keccak256 = (name) => '0x' + keccak_256(name)

contract('Constants', accounts => {
  let keccakConstants

  before(async () => {
    keccakConstants = await getContract('KeccakConstants').new()
  })

  it('checks kernel constants', async () => {
    const kernelConstants = await getContract('KernelConstants').new()

    assert.equal(await kernelConstants.ETH_NODE(), await keccakConstants.ETH_NODE(), "ETH node doesn't match")
    assert.equal(await kernelConstants.APM_NODE(), await keccakConstants.APM_NODE(), "APM node doesn't match")
    assert.equal(await kernelConstants.CORE_NAMESPACE(), await keccakConstants.CORE_NAMESPACE(), "core namespace doesn't match")
    assert.equal(await kernelConstants.APP_BASES_NAMESPACE(), await keccakConstants.APP_BASES_NAMESPACE(), "base namespace doesn't match")
    assert.equal(await kernelConstants.APP_ADDR_NAMESPACE(), await keccakConstants.APP_ADDR_NAMESPACE(), "app namespace doesn't match")

    assert.equal(await kernelConstants.KERNEL_APP_ID(), await keccakConstants.KERNEL_APP_ID(), "kernel app id doesn't match")
    assert.equal(await kernelConstants.KERNEL_APP(), await keccakConstants.KERNEL_APP(), "kernel app doesn't match")

    assert.equal(await kernelConstants.ACL_APP_ID(), await keccakConstants.ACL_APP_ID(), "acl app id doesn't match")
    assert.equal(await kernelConstants.ACL_APP(), await keccakConstants.ACL_APP(), "acl app doesn't match")

    const kernel = await getContract('Kernel').new()
    assert.equal(await kernel.APP_MANAGER_ROLE(), await keccakConstants.APP_MANAGER_ROLE(), "app manager role doesn't match")
    assert.equal(await kernel.DEFAULT_VAULT_ID(), await keccakConstants.DEFAULT_VAULT_ID(), "default vault id doesn't match")
  })

  it('checks ENS constants', async () => {
    const ensConstants = await getContract('ENSConstants').new()

    assert.equal(await ensConstants.ETH_TLD_LABEL(), await keccakConstants.ETH_TLD_LABEL(), "ETH tld label doesn't match")
    assert.equal(await ensConstants.ETH_TLD_NODE(), await keccakConstants.ETH_TLD_NODE(), "ETH tld node doesn't match")
    assert.equal(await ensConstants.PUBLIC_RESOLVER_LABEL(), await keccakConstants.PUBLIC_RESOLVER_LABEL(), "public resolver label doesn't match")
    assert.equal(await ensConstants.PUBLIC_RESOLVER_NODE(), await keccakConstants.PUBLIC_RESOLVER_NODE(), "public resolver node doesn't match")
  })

  it('checks ACL constants', async () => {
    const acl = await getContract('ACL').new()

    assert.equal(await acl.CREATE_PERMISSIONS_ROLE(), await keccakConstants.CREATE_PERMISSIONS_ROLE(), "create permissions role doesn't match")
    assert.equal(await acl.EMPTY_PARAM_HASH(), await keccakConstants.EMPTY_PARAM_HASH(), "empty param hash doesn't match")
  })

  it('checks EVM Script constants', async () => {
    const evmScriptConstants = await getContract('EVMScriptRegistryConstants').new()

    assert.equal(await evmScriptConstants.EVMSCRIPT_REGISTRY_APP_ID(), await keccakConstants.EVMSCRIPT_REGISTRY_APP_ID(), "app id doesn't match")
    assert.equal(await evmScriptConstants.EVMSCRIPT_REGISTRY_APP(), await keccakConstants.EVMSCRIPT_REGISTRY_APP(), "app doesn't match")
  })
})
