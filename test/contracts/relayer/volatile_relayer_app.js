const { sha3, soliditySha3 } = require('web3-utils')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const SampleApp = artifacts.require('RelayerAragonAppWithVolatileSenderMock')

const getEventArgument = (receipt, event, arg) => receipt.logs.filter(l => l.event === event)[0].args[arg]

contract('VolatileRelayerApp', ([_, root, sender, vault, offChainRelayerService]) => {
  let daoFactory, dao, acl, app, relayedTx, nonce = 0
  let kernelBase, aclBase, sampleAppBase
  let WRITING_ROLE, APP_MANAGER_ROLE, OFF_CHAIN_RELAYER_SERVICE_ROLE

  before('deploy base implementations', async () => {
    aclBase = await ACL.new()
    kernelBase = await Kernel.new(true) // petrify immediately
    sampleAppBase = await SampleApp.new()
    daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x0')
  })

  before('load roles', async () => {
    WRITING_ROLE = await sampleAppBase.WRITING_ROLE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    OFF_CHAIN_RELAYER_SERVICE_ROLE = await sampleAppBase.OFF_CHAIN_RELAYER_SERVICE_ROLE()
  })

  before('deploy DAO', async () => {
    const receipt = await daoFactory.newDAO(root)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
  })

  beforeEach('create sample app instance', async () => {
    const receipt = await dao.newAppInstance('0x22222', sampleAppBase.address, '0x', false, { from: root })
    app = SampleApp.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    await app.initialize()

    await web3.eth.sendTransaction({ from: vault, to: app.address, value: 10e18 })
    await acl.createPermission(sender, app.address, WRITING_ROLE, root, { from: root })
    await acl.createPermission(offChainRelayerService, app.address, OFF_CHAIN_RELAYER_SERVICE_ROLE, root, { from: root })
  })

  beforeEach('relay transaction', async () => {
    const calldata = app.contract.write.getData(10)
    const messageHash = soliditySha3(sha3(calldata), nonce)
    const signature = web3.eth.sign(sender, messageHash)

    relayedTx = await app.exec(sender, nonce, calldata, signature, { from: offChainRelayerService })
    nonce++
  })

  it('relays transactions to app', async () => {
    assert.equal((await app.read()).toString(), 10, 'app value does not match')
  })

  it('overloads a transaction with ~84k of gas', async () => {
    const { receipt: { cumulativeGasUsed: relayedGasUsed } } = relayedTx
    const { receipt: { cumulativeGasUsed: nonRelayerGasUsed } } = await app.write(10, { from: sender })

    const gasOverload = relayedGasUsed - nonRelayerGasUsed
    console.log('relayedGasUsed:', relayedGasUsed)
    console.log('nonRelayerGasUsed:', nonRelayerGasUsed)
    console.log('gasOverload:', gasOverload)

    assert.isBelow(gasOverload, 84000, 'relayed txs gas overload is higher than 84k')
  })
})
