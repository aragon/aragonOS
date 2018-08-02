const getContract = name => artifacts.require(name)

contract('Constants', accounts => {
  let app, kernel

  beforeEach(async () => {
    app = await getContract('AppStubStorage').new()
    kernel = await getContract('Kernel').new()
  })

  it('test', async () => {
    const appId = '0x1234000000000000000000000000000000000000000000000000000000000000'
    const pinnedCode = '0x1200000000000000000000000000000000005678'

    // set values
    await app.initialize()
    await app.setKernelExt(kernel.address)
    await app.setAppIdExt(appId)
    await app.setPinnedCodeExt(pinnedCode)

    //checks
    assert.equal(
      parseInt(await web3.eth.getStorageAt(app.address, (await app.getInitializationBlockPosition())), 16),
      (await app.getInitializationBlock.call()).toString(),
      'Init block should match'
    )
    // kernel
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getKernelPosition())),
      (await app.kernel.call()).toString(),
      'Kernel should match'
    )
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getKernelPosition())),
      kernel.address,
      'Kernel original value should match'
    )
    // app id
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getAppIdPosition())),
      (await app.appId.call()).toString(),
      'appId should match'
    )
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getAppIdPosition())),
      appId,
      'appId original value should match'
    )
    // pinned code
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getPinnedCodePosition())),
      (await app.pinnedCodeExt.call()).toString(),
      'Pinned Code should match'
    )
    assert.equal(
      await web3.eth.getStorageAt(app.address, (await app.getPinnedCodePosition())),
      pinnedCode,
      'Pinned Code original value should match'
    )
  })
})
