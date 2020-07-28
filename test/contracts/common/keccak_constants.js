const getContract = name => artifacts.require(name)

contract('Constants', () => {
  let keccakConstants

  before(async () => {
    keccakConstants = await getContract('KeccakConstants').new()
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

  it('checks ACL constants', async () => {
    const acl = await getContract('ACL').new()

    assert.equal(await acl.CREATE_PERMISSIONS_ROLE(), await keccakConstants.CREATE_PERMISSIONS_ROLE(), "create permissions role doesn't match")
    assert.equal(await acl.EMPTY_PARAM_HASH(), await keccakConstants.EMPTY_PARAM_HASH(), "empty param hash doesn't match")
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

  it('checks ReentrancyGuard unstructured storage constants', async () => {
    const reentrancyGuardMock = await getContract('ReentrancyGuardMock').new()
    // Note that this is a bit of a roundabout test for this unstructured storage slot. Since the
    // position is declared as private in the base ReentrancyGuard contract, we redefine in the
    // mock.
    // This test therefore also relies on the ReentrancyGuard's own tests to make sure we've
    // redefined the storage position correctly in the mock.
    assert.equal(await reentrancyGuardMock.getReentrancyMutexPosition(), await keccakConstants.reentrancyGuardPosition(), "reentrancyGuardPosition doesn't match")
  })
})
