const { sha3, soliditySha3 } = require('web3-utils')
const { getEventArgument, getNewProxyAddress } = require('../../helpers/events')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const Relayer = artifacts.require('Relayer')
const DAOFactory = artifacts.require('DAOFactory')
const SampleApp = artifacts.require('RelayedAppMock')

contract('VolatileRelayedApp', ([_, root, sender, vault, offChainRelayerService]) => {
  let daoFactory, dao, acl, app, relayer, relayedTx, nonce = 1
  let kernelBase, aclBase, sampleAppBase, relayerBase
  let WRITING_ROLE, APP_MANAGER_ROLE, RELAYER_ROLE, ALLOW_OFF_CHAIN_SERVICE_ROLE

  before('deploy base implementations', async () => {
    aclBase = await ACL.new()
    kernelBase = await Kernel.new(true) // petrify immediately
    relayerBase = await Relayer.new()
    sampleAppBase = await SampleApp.new()
    daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x0')
  })

  before('load roles', async () => {
    WRITING_ROLE = await sampleAppBase.WRITING_ROLE()
    RELAYER_ROLE = await sampleAppBase.RELAYER_ROLE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    ALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.ALLOW_OFF_CHAIN_SERVICE_ROLE()
  })

  before('deploy DAO', async () => {
    const receipt = await daoFactory.newDAO(root)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
  })

  before('create relayer instance', async () => {
    const receipt = await dao.newAppInstance('0x11111', relayerBase.address, '0x', false, { from: root })
    relayer = Relayer.at(getNewProxyAddress(receipt))
    await relayer.initialize()

    const SEND_ETH_GAS = 31000 // 21k base tx cost + 10k limit on depositable proxies
    await relayer.sendTransaction({ from: vault, value: 1e18, gas: SEND_ETH_GAS })
    await acl.createPermission(root, relayer.address, ALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
    await relayer.allowService(offChainRelayerService, { from: root })
  })

  beforeEach('create sample app instance', async () => {
    const receipt = await dao.newAppInstance('0x22222', sampleAppBase.address, '0x', false, { from: root })
    app = SampleApp.at(getNewProxyAddress(receipt))
    await app.initialize()

    await acl.createPermission(sender, app.address, WRITING_ROLE, root, { from: root })
    await acl.createPermission(relayer.address, app.address, RELAYER_ROLE, root, { from: root })
  })

  beforeEach('relay transaction', async () => {
    const calldata = app.contract.write.getData(10)
    const messageHash = soliditySha3(sha3(calldata), nonce)
    const signature = web3.eth.sign(sender, messageHash)

    relayedTx = await relayer.relay(sender, app.address, nonce, calldata, signature, { from: offChainRelayerService })
    nonce++
  })

  it('relays transactions to app', async () => {
    assert.equal((await app.read()).toString(), 10, 'app value does not match')
  })

  it('overloads a transaction with ~78k of gas', async () => {
    const { receipt: { cumulativeGasUsed: relayedGasUsed } } = relayedTx
    const { receipt: { cumulativeGasUsed: nonRelayerGasUsed } } = await app.write(10, { from: sender })

    const gasOverload = relayedGasUsed - nonRelayerGasUsed
    console.log('relayedGasUsed:', relayedGasUsed)
    console.log('nonRelayerGasUsed:', nonRelayerGasUsed)
    console.log('gasOverload:', gasOverload)

    assert.isBelow(gasOverload, 78000, 'relayed txs gas overload is higher than 78k')
  })
})
