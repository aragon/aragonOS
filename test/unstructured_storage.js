const AppStub = artifacts.require('AppStub')
const Kernel = artifacts.require('Kernel')

// Mocks
const AppStorageMock = artifacts.require('AppStorageMock')
const AppProxyPinnedStorageMock = artifacts.require('AppProxyPinnedStorageMock')
const DepositableStorageMock = artifacts.require('DepositableStorageMock')
const InitializableStorageMock = artifacts.require('InitializableStorageMock')
const KernelPinnedStorageMock = artifacts.require('KernelPinnedStorageMock')

contract('Unstructured storage', accounts => {
  context('> AppStorage', () => {
    let appStorage

    beforeEach(async () => {
      appStorage = await AppStorageMock.new()
    })

    it('tests Kernel storage', async () => {
      const kernel = await Kernel.new(true)
      await appStorage.setKernelExt(kernel.address)
      //checks
      assert.equal(
        await web3.eth.getStorageAt(appStorage.address, (await appStorage.getKernelPosition())),
        (await appStorage.kernel()).toString(),
        'Kernel should match'
      )
      assert.equal(
        await web3.eth.getStorageAt(appStorage.address, (await appStorage.getKernelPosition())),
        kernel.address,
        'Kernel original value should match'
      )
    })

    it('tests appID storage', async () => {
      const appId = '0x1234000000000000000000000000000000000000000000000000000000000000'
      await appStorage.setAppIdExt(appId)
      //checks
      assert.equal(
        await web3.eth.getStorageAt(appStorage.address, (await appStorage.getAppIdPosition())),
        (await appStorage.appId()).toString(),
        'appId should match'
      )
      assert.equal(
        await web3.eth.getStorageAt(appStorage.address, (await appStorage.getAppIdPosition())),
        appId,
        'appId original value should match'
      )
    })
  })

  context('> AppProxyPinned', () => {
    let appPinned
    beforeEach(async () => {
      // Set up AppStubPinnedStorage
      const fakeApp = await AppStub.new()
      const kernelMock = await KernelPinnedStorageMock.new(fakeApp.address)
      appPinned = await AppProxyPinnedStorageMock.new(kernelMock.address)
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

  context('> DepositableStorage', () => {
    let depositableMock

    beforeEach(async () => {
      depositableMock = await DepositableStorageMock.new()
    })

    it('tests depositable', async () => {
      // set values
      await depositableMock.setDepositableExt(true)
      //checks
      assert.equal(
        await web3.eth.getStorageAt(depositableMock.address, (await depositableMock.getDepositablePosition())),
        true,
        'Depositable should match'
      )
    })
  })

  context('> Initializable', () => {
    let initializableMock

    beforeEach(async () => {
      initializableMock = await InitializableStorageMock.new()
    })

    it('tests init block', async () => {
      // set values
      await initializableMock.initialize()
      const blockNumber = web3.eth.blockNumber
      //checks
      assert.equal(
        parseInt(
          await web3.eth.getStorageAt(
            initializableMock.address,
            (await initializableMock.getInitializationBlockPosition())
          ),
          16
        ),
        blockNumber,
        'Init block should match'
      )
      assert.equal(
        parseInt(
          await web3.eth.getStorageAt(
            initializableMock.address,
            (await initializableMock.getInitializationBlockPosition())
          ),
          16
        ),
        (await initializableMock.getInitializationBlock()).toString(),
        'Init block should match'
      )
    })
  })
})
