const AppStub = artifacts.require('AppStub')
const AppStubStorage = artifacts.require('AppStubStorage')
const AppStubPinnedStorage = artifacts.require('AppStubPinnedStorage')
const Kernel = artifacts.require('Kernel')

// Mocks
const KernelPinnedStorageMock = artifacts.require('KernelPinnedStorageMock')

contract('Unstructured storage', accounts => {
  let app, kernel

  beforeEach(async () => {
    app = await AppStubStorage.new()
    kernel = await Kernel.new(true)

    // Set up AppStubPinnedStorage
    const fakeApp = await AppStub.new()
    const kernelMock = await KernelPinnedStorageMock.new(fakeApp.address)
    appPinned = await AppStubPinnedStorage.new(kernelMock.address)
  })

  it('tests init block', async () => {
    // set values
    await app.initialize()
    const blockNumber = web3.eth.blockNumber
    //checks
    assert.equal(
      parseInt(await web3.eth.getStorageAt(app.address, (await app.getInitializationBlockPosition())), 16),
      blockNumber,
      'Init block should match'
    )
    assert.equal(
      parseInt(await web3.eth.getStorageAt(app.address, (await app.getInitializationBlockPosition())), 16),
      (await app.getInitializationBlock()).toString(),
      'Init block should match'
    )
  })

  it('tests Kernel storage', async () => {
    await app.setKernelExt(kernel.address)
    //checks
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getKernelPosition())),
      (await app.kernel()).toString(),
      'Kernel should match'
    )
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getKernelPosition())),
      kernel.address,
      'Kernel original value should match'
    )
  })

  it('tests appID storage', async () => {
    const appId = '0x1234000000000000000000000000000000000000000000000000000000000000'
    await app.setAppIdExt(appId)
    //checks
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getAppIdPosition())),
      (await app.appId()).toString(),
      'appId should match'
    )
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getAppIdPosition())),
      appId,
      'appId original value should match'
    )
  })

  it('tests pinnedCode storage', async () => {
    const pinnedCode = '0x1200000000000000000000000000000000005678'
    await appPinned.setPinnedCodeExt(pinnedCode)
    //checks
    assert.equal(
      await web3.eth.getStorageAt(appPinned.address, (await appPinned.getPinnedCodePosition())),
      (await appPinned.pinnedCodeExt()).toString(),
      'Pinned Code should match'
    )
    assert.equal(
      await web3.eth.getStorageAt(appPinned.address, (await appPinned.getPinnedCodePosition())),
      pinnedCode,
      'Pinned Code original value should match'
    )
  })
})
