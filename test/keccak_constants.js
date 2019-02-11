const namehash = require('eth-ens-namehash').hash
const keccak_256 = require('js-sha3').keccak_256

const getContract = name => artifacts.require(name)
const keccak256 = (name) => '0x' + keccak_256(name)

contract('Constants', accounts => {
  let keccakConstants

  before(async () => {
    keccakConstants = await getContract('KeccakConstants').new()
  })

  it('checks ENS constants', async () => {
    const ensConstants = await getContract('ENSConstantsMock').new()

    assert.equal(await ensConstants.getEthTldLabel(), await keccakConstants.ETH_TLD_LABEL(), "ETH tld label doesn't match")
    assert.equal(await ensConstants.getEthTldNode(), await keccakConstants.ETH_TLD_NODE(), "ETH tld node doesn't match")
    assert.equal(await ensConstants.getPublicResolverLabel(), await keccakConstants.PUBLIC_RESOLVER_LABEL(), "public resolver label doesn't match")
    assert.equal(await ensConstants.getPublicResolverNode(), await keccakConstants.PUBLIC_RESOLVER_NODE(), "public resolver node doesn't match")
  })

  it('checks APMNamehash constants', async () => {
    const apmNamehash = await getContract('APMNamehashMock').new()

    assert.equal(await apmNamehash.getAPMNode(), await keccakConstants.APM_NODE(), "APM node doesn't match")
  })

  it('checks kernel constants', async () => {
    const kernelConstants = await getContract('KernelConstantsMock').new()
    assert.equal(await kernelConstants.getKernelAppId(), await keccakConstants.KERNEL_APP_ID(), "kernel app id doesn't match")
    assert.equal(await kernelConstants.getDefaultACLAppId(), await keccakConstants.DEFAULT_ACL_APP_ID(), "default ACL id doesn't match")
    assert.equal(await kernelConstants.getDefaultVaultAppId(), await keccakConstants.DEFAULT_VAULT_APP_ID(), "default vault id doesn't match")
    assert.equal(await kernelConstants.getKernelCoreNamespace(), await keccakConstants.KERNEL_CORE_NAMESPACE(), "core namespace doesn't match")
    assert.equal(await kernelConstants.getKernelAppBasesNamespace(), await keccakConstants.KERNEL_APP_BASES_NAMESPACE(), "base namespace doesn't match")
    assert.equal(await kernelConstants.getKernelAppAddrNamespace(), await keccakConstants.KERNEL_APP_ADDR_NAMESPACE(), "app namespace doesn't match")

    const kernel = await getContract('Kernel').new(false)
    assert.equal(await kernel.APP_MANAGER_ROLE(), await keccakConstants.APP_MANAGER_ROLE(), "app manager role doesn't match")
    assert.equal(await kernel.KERNEL_APP_ID(), await keccakConstants.KERNEL_APP_ID(), "app id doesn't match")
    assert.equal(await kernel.DEFAULT_ACL_APP_ID(), await keccakConstants.DEFAULT_ACL_APP_ID(), "default acl id doesn't match")
    assert.equal(await kernel.CORE_NAMESPACE(), await keccakConstants.KERNEL_CORE_NAMESPACE(), "core namespace doesn't match")
    assert.equal(await kernel.APP_BASES_NAMESPACE(), await keccakConstants.KERNEL_APP_BASES_NAMESPACE(), "base namespace doesn't match")
    assert.equal(await kernel.APP_ADDR_NAMESPACE(), await keccakConstants.KERNEL_APP_ADDR_NAMESPACE(), "app namespace doesn't match")
  })

  it('checks APMRegistry constants', async () => {
    const apm = await getContract('APMRegistry').new()

    assert.equal(await apm.CREATE_REPO_ROLE(), await keccakConstants.CREATE_REPO_ROLE(), "create repo role doesn't match")
  })

  it('checks ACL constants', async () => {
    const acl = await getContract('ACL').new()

    assert.equal(await acl.CREATE_PERMISSIONS_ROLE(), await keccakConstants.CREATE_PERMISSIONS_ROLE(), "create permissions role doesn't match")
  })

  it('checks ENSSubdomainRegistrar constants', async () => {
    const ensRegistrar = await getContract('ENSSubdomainRegistrar').new()

    assert.equal(await ensRegistrar.CREATE_NAME_ROLE(), await keccakConstants.CREATE_NAME_ROLE(), "create name role doesn't match")
    assert.equal(await ensRegistrar.DELETE_NAME_ROLE(), await keccakConstants.DELETE_NAME_ROLE(), "delete name role doesn't match")
    assert.equal(await ensRegistrar.POINT_ROOTNODE_ROLE(), await keccakConstants.POINT_ROOTNODE_ROLE(), "point rootnode role doesn't match")
  })

  it('checks EVM Script constants', async () => {
    const evmScriptConstants = await getContract('EVMScriptRegistryConstantsMock').new()

    assert.equal(await evmScriptConstants.getEVMScriptRegistryAppId(), await keccakConstants.EVMSCRIPT_REGISTRY_APP_ID(), "app id doesn't match")
  })

  it('checks EVM Script executor types', async () => {
    const callsScriptExecutor = await getContract('CallsScript').new()

    assert.equal(await callsScriptExecutor.executorType(), await keccakConstants.EVMSCRIPT_EXECUTOR_CALLS_SCRIPT(), "callscript executor type doesn't match")
  })

  it('checks EVMScriptRegistry constants', async () => {
    const evmScriptRegistry = await getContract('EVMScriptRegistry').new()

    assert.equal(await evmScriptRegistry.REGISTRY_ADD_EXECUTOR_ROLE(), await keccakConstants.REGISTRY_ADD_EXECUTOR_ROLE(), "registry add executor role doesn't match")
    assert.equal(await evmScriptRegistry.REGISTRY_MANAGER_ROLE(), await keccakConstants.REGISTRY_MANAGER_ROLE(), "registry manager role doesn't match")
  })

  it('checks Repo constants', async () => {
    const repo = await getContract('Repo').new()

    assert.equal(await repo.CREATE_VERSION_ROLE(), await keccakConstants.CREATE_VERSION_ROLE(), "create version role doesn't match")
  })

  it('checks AppStorage unstructured storage constants', async () => {
    const appStorage = await getContract('AppStorageMock').new()

    assert.equal(await appStorage.getKernelPosition(), await keccakConstants.kernelPosition(), "kernelPosition doesn't match")
    assert.equal(await appStorage.getAppIdPosition(), await keccakConstants.appIdPosition(), "appIdPosition doesn't match")
  })

  it('checks AppProxyPinned unstructured storage constants', async () => {
    // Set up AppStubPinnedStorage
    const fakeApp = await getContract('AppStub').new()
    const kernelMock = await getContract('KernelPinnedStorageMock').new(fakeApp.address)
    const pinnedProxy = await getContract('AppProxyPinnedStorageMock').new(kernelMock.address)

    assert.equal(await pinnedProxy.getPinnedCodePosition(), await keccakConstants.pinnedCodePosition(), "pinnedCodePosition doesn't match")
  })

  it('checks DepositableStorage unstructured storage constants', async () => {
    const depositableMock = await getContract('DepositableStorageMock').new()
    assert.equal(await depositableMock.getDepositablePosition(), await keccakConstants.depositablePosition(), "depositablePosition doesn't match")
  })

  it('checks Initializable unstructured storage constants', async () => {
    const initializableMock = await getContract('InitializableStorageMock').new()
    assert.equal(await initializableMock.getInitializationBlockPosition(), await keccakConstants.initializationBlockPosition(), "initializationBlockPosition doesn't match")
  })
})
