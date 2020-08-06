const { hash } = require('eth-ens-namehash')
const { assertEvent } = require('../../helpers/assertEvent')(web3)
const { getEventArgument } = require('../../helpers/events')
const web3EthAbi = require('web3-eth-abi');

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AppStorage = artifacts.require('AppStorage')
const AppProxyFactory = artifacts.require('AppProxyFactory')
const AppStub = artifacts.require('AppStub')

// Mocks
const APP_ID = hash('stub.aragonpm.test')

contract('App Proxy Factory', accounts => {
  let aclBase, kernel, kernelBase, appBase, appProxyFactory
  let APP_BASES_NAMESPACE

  const permissionsRoot = accounts[0]

  before(async () => {
    aclBase = await ACL.new()
    appBase = await AppStub.new()

    // Setup constants
    kernelBase = await Kernel.new(true)
    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
    await kernel.initialize(aclBase.address, permissionsRoot)
    acl = ACL.at(await kernel.acl())

    // Set up app management permissions
    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(permissionsRoot, kernel.address, APP_MANAGER_ROLE, permissionsRoot)

    // Set app
    await kernel.setApp(APP_BASES_NAMESPACE, APP_ID, appBase.address)

    // Deploy test instance
    appProxyFactory = await AppProxyFactory.new()
  })

  it('deploys a new App Proxy without initialization payload', async () => {
    const receipt = await appProxyFactory.newAppProxy(kernel.address, APP_ID)

    assertEvent(receipt, 'NewAppProxy', { isUpgradeable: true, appId: APP_ID })
    
    const appProxy = AppStorage.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    assert.equal(await appProxy.kernel(), kernel.address, 'should have set the correct kernel')
    assert.equal(await appProxy.appId(), APP_ID, 'should have set the correct appId')
  })

  it('deploys a new App Proxy Pinned without initialization payload', async () => {
    // Manually sending the transaction to overcome truffle@4.x limitations with overloaded functions
    const receipt = await appProxyFactory.sendTransaction({
      from: permissionsRoot,
      data: web3EthAbi.encodeFunctionCall({
        "constant": false,
        "inputs": [
          { "name": "_kernel", "type": "address" },
          { "name": "_appId", "type": "bytes32" }
        ],
        "name": "newAppProxyPinned",
        "outputs": [
          { "name": "", "type": "address" }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }, [kernel.address, APP_ID])
    })
    
    assertEvent(receipt, 'NewAppProxy', { isUpgradeable: false, appId: APP_ID })
    
    const appProxy = AppStorage.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    assert.equal(await appProxy.kernel(), kernel.address, 'should have set the correct kernel')
    assert.equal(await appProxy.appId(), APP_ID, 'should have set the correct appId')
  })
})
