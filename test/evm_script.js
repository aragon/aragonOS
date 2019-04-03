const { rawEncode } = require('ethereumjs-abi')
const { soliditySha3 } = require('web3-utils')

const assertEvent = require('./helpers/assertEvent')
const { assertRevert } = require('./helpers/assertThrow')
const { encodeCallScript } = require('./helpers/evmScript')
const reverts = require('./helpers/revertStrings')

const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const ACL = artifacts.require('ACL')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const CallsScript = artifacts.require('CallsScript')
const IEVMScriptExecutor = artifacts.require('IEVMScriptExecutor')

// Mocks
const AppStubScriptExecutor = artifacts.require('AppStubScriptExecutor')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const EVMScriptExecutorMock = artifacts.require('EVMScriptExecutorMock')
const EVMScriptRegistryConstantsMock = artifacts.require('EVMScriptRegistryConstantsMock')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract.only('EVM Script', accounts => {
  let kernelBase, aclBase, evmScriptRegBase, dao, acl, evmScriptReg
  let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE, APP_MANAGER_ROLE
  let EVMSCRIPT_REGISTRY_APP_ID, REGISTRY_ADD_EXECUTOR_ROLE, REGISTRY_MANAGER_ROLE

  const boss = accounts[1]

  const executorAppId = '0x1234'

  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    evmScriptRegBase = await EVMScriptRegistry.new()
    const evmScriptRegConstants = await EVMScriptRegistryConstantsMock.new()

    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernelBase.APP_ADDR_NAMESPACE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()

    EVMSCRIPT_REGISTRY_APP_ID = await evmScriptRegConstants.getEVMScriptRegistryAppId()
    REGISTRY_ADD_EXECUTOR_ROLE = await evmScriptRegBase.REGISTRY_ADD_EXECUTOR_ROLE()
    REGISTRY_MANAGER_ROLE = await evmScriptRegBase.REGISTRY_MANAGER_ROLE()
  })

  beforeEach(async () => {
    dao = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
    await dao.initialize(aclBase.address, boss)
    acl = ACL.at(await dao.acl())

    // Set up app management permissions
    await acl.createPermission(boss, dao.address, APP_MANAGER_ROLE, boss, { from: boss })

    // Set up script registry (MUST use correct app ID and set as default app)
    const initPayload = evmScriptRegBase.contract.initialize.getData()
    const evmScriptRegReceipt = await dao.newAppInstance(EVMSCRIPT_REGISTRY_APP_ID, evmScriptRegBase.address, initPayload, true, { from: boss })
    evmScriptReg = EVMScriptRegistry.at(evmScriptRegReceipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
  })

  context('> Registry', () => {
    let executorMock

    before(async () => {
      executorMock = await EVMScriptExecutorMock.new()
    })

    beforeEach(async () => {
      await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
    })

    it('is initialized', async () => {
      assert.isTrue(await evmScriptReg.hasInitialized(), "should be initialized")
    })

    it('fails if reinitializing registry', async () => {
      await assertRevert(evmScriptReg.initialize(), reverts.INIT_ALREADY_INITIALIZED)
    })

    it('fails to get an executor if not enough bytes are given', async () => {
      // Not enough bytes are given (need 4, given 3)
      await assertRevert(evmScriptReg.getScriptExecutor('0x'.padEnd(6, 0)), reverts.EVMREG_SCRIPT_LENGTH_TOO_SHORT)
    })

    it('can add a new executor', async () => {
      const receipt = await evmScriptReg.addScriptExecutor(executorMock.address, { from: boss })

      const newExecutorId = receipt.logs.filter(l => l.event == 'EnableExecutor')[0].args.executorId
      const [executorAddress, executorEnabled] = await evmScriptReg.executors(newExecutorId)
      const newExecutor = IEVMScriptExecutor.at(executorAddress)

      assert.equal(await executorMock.executorType(), await newExecutor.executorType(), "executor type should be the same")
      assert.equal(await executorMock.address, await executorAddress, "executor address should be the same")
      assert.isTrue(executorEnabled, "new executor should be enabled")
    })

    it('fails to add a new executor without the correct permissions', async () => {
      await assertRevert(evmScriptReg.addScriptExecutor(executorMock.address), reverts.APP_AUTH_FAILED)
    })

    context('> Existing executor', () => {
      let installedExecutorId

      beforeEach(async () => {
        const receipt = await evmScriptReg.addScriptExecutor(executorMock.address, { from: boss })

        installedExecutorId = receipt.logs.filter(l => l.event == 'EnableExecutor')[0].args.executorId
      })

      it('can disable an executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        let executorEntry = await evmScriptReg.executors(installedExecutorId)
        assert.isTrue(executorEntry[1], "executor should be enabled")

        const receipt = await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })
        executorEntry = await evmScriptReg.executors(installedExecutorId)

        assertEvent(receipt, 'DisableExecutor')
        assert.isFalse(executorEntry[1], "executor should now be disabled")
        assert.equal(await evmScriptReg.getScriptExecutor(`0x0000000${installedExecutorId}`), ZERO_ADDR, 'getting disabled executor should return zero addr')
      })

      it('can re-enable an executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })
        let executorEntry = await evmScriptReg.executors(installedExecutorId)
        assert.isFalse(executorEntry[1], "executor should now be disabled")
        assert.equal(await evmScriptReg.getScriptExecutor(`0x0000000${installedExecutorId}`), ZERO_ADDR, 'getting disabled executor should return zero addr')

        const receipt = await evmScriptReg.enableScriptExecutor(installedExecutorId, { from: boss })
        executorEntry = await evmScriptReg.executors(installedExecutorId)

        assertEvent(receipt, 'EnableExecutor')
        assert.isTrue(executorEntry[1], "executor should now be re-enabled")
        assert.notEqual(await evmScriptReg.getScriptExecutor(`0x0000000${installedExecutorId}`), ZERO_ADDR, 'getting disabled executor should return non-zero addr')
      })

      it('fails to disable an executor without the correct permissions', async () => {
        await assertRevert(evmScriptReg.disableScriptExecutor(installedExecutorId), reverts.APP_AUTH_FAILED)
      })

      it('fails to enable an executor without the correct permissions', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })
        await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })

        await assertRevert(evmScriptReg.enableScriptExecutor(installedExecutorId), reverts.APP_AUTH_FAILED)
      })

      it('fails to enable an already enabled executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })
        await assertRevert(evmScriptReg.enableScriptExecutor(installedExecutorId, { from: boss }), reverts.EVMREG_EXECUTOR_ENABLED)
      })

      it('fails to enable a non-existent executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })
        await assertRevert(evmScriptReg.enableScriptExecutor(installedExecutorId + 1, { from: boss }), reverts.EVMREG_INEXISTENT_EXECUTOR)
      })

      it('fails to disable an already disabled executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })
        await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })

        await assertRevert(evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss }), reverts.EVMREG_EXECUTOR_DISABLED)
      })
    })
  })

  context('> Executor', () => {
    let executorApp, executionTarget

    before(async () => {
      executorAppBase = await AppStubScriptExecutor.new()
    })

    beforeEach(async () => {
      executionTarget = await ExecutionTarget.new()

      const receipt = await dao.newAppInstance(executorAppId, executorAppBase.address, '0x', false, { from: boss })
      executorApp = AppStubScriptExecutor.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
      await executorApp.initialize()
    })

    it('gets the correct executor registry from the app', async () => {
      const registryFromApp = await executorApp.getEVMScriptRegistry()
      assert.equal(evmScriptReg.address, registryFromApp, 'app should return the same EVMScriptRegistry')
    })

    it('fails to execute if spec ID is 0', async () => {
      await assertRevert(executorApp.execute('0x00000000'), reverts.EVMRUN_EXECUTOR_UNAVAILABLE)
    })

    it('fails to execute if spec ID is unknown', async () => {
      await assertRevert(executorApp.execute('0x00000004'), reverts.EVMRUN_EXECUTOR_UNAVAILABLE)
    })

    context('> CallsScript', () => {
      let callsScriptBase

      beforeEach(async () => {
        callsScriptBase = await CallsScript.new()

        // Install CallsScript onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(callsScriptBase.address, { from: boss })

        // Sanity check it's at spec ID 1
        const callsScriptExecutorId = receipt.logs.filter(l => l.event == 'EnableExecutor')[0].args.executorId
        assert.equal(callsScriptExecutorId, 1, 'CallsScript should be installed as spec ID 1')
      })

      it('fails if directly calling base executor', async () => {
        const executionTarget = await ExecutionTarget.new()
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await assertRevert(callsScriptBase.execScript(script, '0x', []), reverts.INIT_NOT_INITIALIZED)
      })

      it('is the correct executor type', async () => {
        const CALLS_SCRIPT_TYPE = soliditySha3('CALLS_SCRIPT')
        const executor = IEVMScriptExecutor.at(await evmScriptReg.getScriptExecutor('0x00000001'))
        assert.equal(await executor.executorType(), CALLS_SCRIPT_TYPE)
      })

      it('gets the correct executor from the app', async () => {
        const script = '0x00000001'
        const executor = await evmScriptReg.getScriptExecutor(script)

        const scriptExecutor = await executorApp.getEVMScriptExecutor(script)
        assert.equal(executor, scriptExecutor, 'app should return the same evm script executor')
      })

      it('executes single action script', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        const receipt = await executorApp.execute(script)

        assert.equal(await executionTarget.counter(), 1, 'should have executed action')

        // Check logs
        // The Executor always uses 0x for the input and callscripts always have 0x returns
        const scriptResult = receipt.logs.filter(l => l.event == 'ScriptResult')[0]
        assert.equal(scriptResult.args.executor, await evmScriptReg.getScriptExecutor('0x00000001'), 'should log the same executor')
        assert.equal(scriptResult.args.script, script, 'should log the same script')
        assert.equal(scriptResult.args.input, '0x', 'should log the same input')
        assert.equal(scriptResult.args.returnData, '0x', 'should log the return data')
      })

      it("can execute if call doesn't contain blacklist addresses", async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await executorApp.executeWithBan(script, ['0x1234'])

        assert.equal(await executionTarget.counter(), 1, 'should have executed action')
      })

      it('executes multi action script', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action, action, action, action])

        await executorApp.execute(script)

        assert.equal(await executionTarget.counter(), 4, 'should have executed multiple actions')
      })

      it('executes multi action script to multiple addresses', async () => {
        const executionTarget2 = await ExecutionTarget.new()

        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const action2 = { to: executionTarget2.address, calldata: executionTarget2.contract.execute.getData() }

        const script = encodeCallScript([action2, action, action2, action, action2])

        await executorApp.execute(script)

        assert.equal(await executionTarget.counter(), 2, 'should have executed action')
        assert.equal(await executionTarget2.counter(), 3, 'should have executed action')
      })

      it('executes with parameters', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.setCounter.getData(101) }
        const script = encodeCallScript([action])

        await executorApp.execute(script)

        assert.equal(await executionTarget.counter(), 101, 'should have set counter')
      })

      it('execution fails if one call fails', async () => {
        const action1 = { to: executionTarget.address, calldata: executionTarget.contract.setCounter.getData(101) }
        const action2 = { to: executionTarget.address, calldata: executionTarget.contract.failExecute.getData() }

        const script = encodeCallScript([action1, action2])

        // EVMScriptRunner doesn't pass through the revert yet
        await assertRevert(executorApp.execute(script), reverts.EVMRUN_EXECUTION_REVERTED)
      })

      it('can execute empty script', async () => {
        await executorApp.execute(encodeCallScript([]))
      })

      it('fails to execute if has blacklist addresses being called', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        // EVMScriptRunner doesn't pass through the revert yet
        await assertRevert(executorApp.executeWithBan(script, [executionTarget.address]), reverts.EVMRUN_EXECUTION_REVERTED)
      })

      context('> Script underflow', () => {
        const encodeCallScriptAddressUnderflow = actions => {
          return actions.reduce((script, { to }) => {
            const addr = rawEncode(['address'], [to]).toString('hex')

            // Remove too much of the address (should just remove first 12 0s of padding as addr)
            return script + addr.slice(24 + 4)
          }, '0x00000001') // spec 1
        }

        const encodeCallScriptCalldataUnderflow = actions => {
          return actions.reduce((script, { to, calldata }) => {
            const addr = rawEncode(['address'], [to]).toString('hex')
            const length = rawEncode(['uint256'], [calldata.length]).toString('hex')

            // Remove too much of the calldataLength (should just remove first 28 0s of padding as uint32)
            return script + addr.slice(24) + length.slice(56 + 4)
          }, '0x00000001') // spec 1
        }

        it('fails if data length is too small to contain address', async () => {
          const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
          const script = encodeCallScriptAddressUnderflow([action])

          // EVMScriptRunner doesn't pass through the revert yet
          await assertRevert(executorApp.execute(script), reverts.EVMRUN_EXECUTION_REVERTED)
        })

        it('fails if data length is too small to contain calldata', async () => {
          const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
          const script = encodeCallScriptCalldataUnderflow([action])

          // EVMScriptRunner doesn't pass through the revert yet
          await assertRevert(executorApp.execute(script), reverts.EVMRUN_EXECUTION_REVERTED)
        })
      })

      context('> Script overflow', () => {
        const encodeCallScriptCalldataOverflow = actions => {
          return actions.reduce((script, { to, calldata }) => {
            const addr = rawEncode(['address'], [to]).toString('hex')
            // length should be (calldata.length - 2) / 2 instead of calldata.length
            // as this one is bigger, it would overflow and therefore must revert
            const length = rawEncode(['uint256'], [calldata.length]).toString('hex')

            // Remove 12 first 0s of padding for addr and 28 0s for uint32
            return script + addr.slice(24) + length.slice(56) + calldata.slice(2)
          }, '0x00000001') // spec 1
        }

        it('fails if data length is too big', async () => {
          const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
          const script = encodeCallScriptCalldataOverflow([action])

          // EVMScriptRunner doesn't pass through the revert yet
          await assertRevert(executorApp.execute(script), reverts.EVMRUN_EXECUTION_REVERTED)
        })
      })
    })

    context('> Registry actions', () => {
      let executorMock, executorSpecId

      before(async () => {
        executorMock = await EVMScriptExecutorMock.new()
      })

      beforeEach(async () => {
        // Let boss enable and disable executors
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        // Install mock executor onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(executorMock.address, { from: boss })

        executorSpecId = receipt.logs.filter(l => l.event == 'EnableExecutor')[0].args.executorId
      })

      it("can't execute disabled spec ID", async () => {
        await evmScriptReg.disableScriptExecutor(executorSpecId, { from: boss })

        await assertRevert(executorApp.execute(encodeCallScript([])), reverts.EVMRUN_EXECUTOR_UNAVAILABLE)
      })

      it('can execute once spec ID is re-enabled', async () => {
        // Disable then re-enable the executor
        await evmScriptReg.disableScriptExecutor(executorSpecId, { from: boss })
        await evmScriptReg.enableScriptExecutor(executorSpecId, { from: boss })

        await executorApp.execute(encodeCallScript([]))
      })
    })

    context('> Uninitialized', () => {
      beforeEach(async () => {
        const receipt = await dao.newAppInstance(executorAppId, executorAppBase.address, '0x', false, { from: boss })
        executorApp = AppStubScriptExecutor.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
        // Explicitly don't initialize the executorApp
      })

      it('fails to execute any executor', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await assertRevert(executorApp.execute(script), reverts.INIT_NOT_INITIALIZED)
      })
    })
  })
})
