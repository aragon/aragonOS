const { assertEvent } = require('../../helpers/assertEvent')(web3)
const { createExecutorId, encodeCallScript } = require('../../helpers/evmScript')
const { getEventArgument, getNewProxyAddress } = require('../../helpers/events')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

// Mocks
const AppStubScriptRunner = artifacts.require('AppStubScriptRunner')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const EVMScriptRegistryConstantsMock = artifacts.require('EVMScriptRegistryConstantsMock')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES = '0x'

contract('EVM Script Factory', ([permissionsRoot]) => {
  let evmScriptRegBase, callsScriptBase
  let daoFact, regFact, dao, acl, evmScriptReg
  let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE, APP_MANAGER_ROLE, CREATE_PERMISSIONS_ROLE
  let EVMSCRIPT_REGISTRY_APP_ID, REGISTRY_ADD_EXECUTOR_ROLE, REGISTRY_MANAGER_ROLE

  const SCRIPT_RUNNER_APP_ID = '0x1234'

  before(async () => {
    const kernelBase = await Kernel.new(true) // petrify immediately
    const aclBase = await ACL.new()

    regFact = await EVMScriptRegistryFactory.new()
    daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)
    callsScriptBase = await regFact.baseCallScript()
    evmScriptRegBase = EVMScriptRegistry.at(await regFact.baseReg())
    const evmScriptRegConstants = await EVMScriptRegistryConstantsMock.new()

    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernelBase.APP_ADDR_NAMESPACE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    CREATE_PERMISSIONS_ROLE = await aclBase.CREATE_PERMISSIONS_ROLE()

    EVMSCRIPT_REGISTRY_APP_ID = await evmScriptRegConstants.getEVMScriptRegistryAppId()
    REGISTRY_ADD_EXECUTOR_ROLE = await evmScriptRegBase.REGISTRY_ADD_EXECUTOR_ROLE()
    REGISTRY_MANAGER_ROLE = await evmScriptRegBase.REGISTRY_MANAGER_ROLE()
  })

  beforeEach(async () => {
    const receipt = await daoFact.newDAO(permissionsRoot)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    evmScriptReg = EVMScriptRegistry.at(getEventArgument(receipt, 'DeployEVMScriptRegistry', 'reg'))

    acl = ACL.at(await dao.acl())
  })

  it('factory installed EVMScriptRegistry correctly', async () => {
    assert.equal(await dao.getApp(APP_BASES_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID), evmScriptRegBase.address, 'should have set correct base EVMScriptRegistry app in kernel')
    assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID), evmScriptReg.address, 'should have set correct default EVMScriptRegistry app in kernel')
    assert.isTrue(await evmScriptReg.hasInitialized(), "should be initialized")
  })

  it('factory registered just 1 script executor', async () => {
    assert.equal(await evmScriptReg.getScriptExecutor(createExecutorId(0)), ZERO_ADDR, 'spec ID 0 should always be empty')
    assert.notEqual(await evmScriptReg.getScriptExecutor(createExecutorId(1)), callsScriptBase.address, 'spec ID 1 should be calls script')
    assert.equal(await evmScriptReg.getScriptExecutor(createExecutorId(2)), ZERO_ADDR, 'spec ID 2 and higher should be empty')
  })

  it('factory cleaned up permissions', async () => {
    assert.isFalse(await acl.hasPermission(regFact.address, dao.address, APP_MANAGER_ROLE), 'EVMScriptRegistryFactory should not have APP_MANAGER_ROLE for created kernel')
    assert.isFalse(await acl.hasPermission(regFact.address, acl.address, CREATE_PERMISSIONS_ROLE), 'EVMScriptRegistryFactory should not have CREATE_PERMISSIONS_ROLE for created ACL')
    assert.isFalse(await acl.hasPermission(regFact.address, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE), 'EVMScriptRegistryFactory should not have REGISTRY_ADD_EXECUTOR_ROLE for created EVMScriptRegistry')
    assert.isFalse(await acl.hasPermission(regFact.address, evmScriptReg.address, REGISTRY_MANAGER_ROLE), 'EVMScriptRegistryFactory should not have REGISTRY_MANAGER_ROLE for created EVMScriptRegistry')

    assert.equal(await acl.getPermissionManager(evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE), ZERO_ADDR, 'created EVMScriptRegistry should not have manager for REGISTRY_ADD_EXECUTOR_ROLE')
    assert.equal(await acl.getPermissionManager(evmScriptReg.address, REGISTRY_MANAGER_ROLE), ZERO_ADDR, 'created EVMScriptRegistry should not have manager for REGISTRY_MANAGER_ROLE')
  })

  context('> Executor app', () => {
    let scriptRunnerAppBase, scriptRunnerApp, executionTarget

    before(async () => {
      scriptRunnerAppBase = await AppStubScriptRunner.new()
    })

    beforeEach(async () => {
      // Set up app management permissions
      await acl.createPermission(permissionsRoot, dao.address, APP_MANAGER_ROLE, permissionsRoot)

      const receipt = await dao.newAppInstance(SCRIPT_RUNNER_APP_ID, scriptRunnerAppBase.address, EMPTY_BYTES, false)
      scriptRunnerApp = AppStubScriptRunner.at(getNewProxyAddress(receipt))
      await scriptRunnerApp.initialize()
      executionTarget = await ExecutionTarget.new()
    })

    it('gets the correct executor registry from the app', async () => {
      const registryFromApp = await scriptRunnerApp.getEVMScriptRegistry()
      assert.equal(evmScriptReg.address, registryFromApp, 'app should return the same EVMScriptRegistry')
    })

    it('gets the correct executor from the app', async () => {
      const script = createExecutorId(1)
      const executor = await evmScriptReg.getScriptExecutor(script)

      const scriptExecutor = await scriptRunnerApp.getEVMScriptExecutor(script)
      assert.equal(executor, scriptExecutor, 'app should return the same evm script executor')
    })

    it('can execute calls script (spec ID 1)', async () => {
      const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
      const script = encodeCallScript([action], 1)

      const receipt = await scriptRunnerApp.runScript(script)

      assert.equal(await executionTarget.counter(), 1, 'should have executed action')

      // The executor always uses 0x for the input and callscripts always have 0x returns
      const expectedExecutor = await evmScriptReg.getScriptExecutor(createExecutorId(1))
      assertEvent(receipt, 'ScriptResult', { executor: expectedExecutor, script, input: EMPTY_BYTES, returnData: EMPTY_BYTES })
    })
  })
})
