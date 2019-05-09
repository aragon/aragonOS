const reverts = require('../../helpers/revertStrings')
const { rawEncode } = require('ethereumjs-abi')
const { soliditySha3 } = require('web3-utils')
const { assertRevert } = require('../../helpers/assertThrow')
const { createExecutorId, encodeCallScript } = require('../../helpers/evmScript')
const { assertEvent, assertAmountOfEvents } = require('../../helpers/assertEvent')(web3)
const { getEventArgument, getNewProxyAddress } = require('../../helpers/events')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const CallsScript = artifacts.require('CallsScript')
const IEVMScriptExecutor = artifacts.require('IEVMScriptExecutor')

// Mocks
const AppStubScriptRunner = artifacts.require('AppStubScriptRunner')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const EVMScriptExecutorMock = artifacts.require('EVMScriptExecutorMock')
const EVMScriptExecutorNoReturnMock = artifacts.require('EVMScriptExecutorNoReturnMock')
const EVMScriptExecutorRevertMock = artifacts.require('EVMScriptExecutorRevertMock')
const EVMScriptRegistryConstantsMock = artifacts.require('EVMScriptRegistryConstantsMock')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES = '0x'

contract('EVM Script', ([_, boss]) => {
  let kernelBase, aclBase, evmScriptRegBase, dao, acl, evmScriptReg
  let scriptExecutorMock, scriptExecutorNoReturnMock, scriptExecutorRevertMock
  let APP_BASES_NAMESPACE, APP_ADDR_NAMESPACE, APP_MANAGER_ROLE
  let EVMSCRIPT_REGISTRY_APP_ID, REGISTRY_ADD_EXECUTOR_ROLE, REGISTRY_MANAGER_ROLE
  let ERROR_MOCK_REVERT, ERROR_EXECUTION_TARGET

  const SCRIPT_RUNNER_APP_ID = '0x1234'

  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    evmScriptRegBase = await EVMScriptRegistry.new()
    scriptExecutorMock = await EVMScriptExecutorMock.new()
    scriptExecutorNoReturnMock = await EVMScriptExecutorNoReturnMock.new()
    scriptExecutorRevertMock = await EVMScriptExecutorRevertMock.new()
    const evmScriptRegConstants = await EVMScriptRegistryConstantsMock.new()
    const executionTarget = await ExecutionTarget.new()

    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernelBase.APP_ADDR_NAMESPACE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()

    EVMSCRIPT_REGISTRY_APP_ID = await evmScriptRegConstants.getEVMScriptRegistryAppId()
    REGISTRY_ADD_EXECUTOR_ROLE = await evmScriptRegBase.REGISTRY_ADD_EXECUTOR_ROLE()
    REGISTRY_MANAGER_ROLE = await evmScriptRegBase.REGISTRY_MANAGER_ROLE()

    ERROR_MOCK_REVERT = await scriptExecutorRevertMock.ERROR_MOCK_REVERT()
    ERROR_EXECUTION_TARGET = await executionTarget.ERROR_EXECUTION_TARGET()
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
    evmScriptReg = EVMScriptRegistry.at(getNewProxyAddress(evmScriptRegReceipt))
  })

  context('> Registry', () => {
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
      const receipt = await evmScriptReg.addScriptExecutor(scriptExecutorMock.address, { from: boss })

      const newExecutorId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
      const [executorAddress, executorEnabled] = await evmScriptReg.executors(newExecutorId)
      const newExecutor = IEVMScriptExecutor.at(executorAddress)

      assert.equal(await scriptExecutorMock.executorType(), await newExecutor.executorType(), "executor type should be the same")
      assert.equal(await scriptExecutorMock.address, await executorAddress, "executor address should be the same")
      assert.isTrue(executorEnabled, "new executor should be enabled")
    })

    it('fails to add a new executor without the correct permissions', async () => {
      await assertRevert(evmScriptReg.addScriptExecutor(scriptExecutorMock.address), reverts.APP_AUTH_FAILED)
    })

    context('> Existing executor', () => {
      let installedExecutorId

      beforeEach(async () => {
        const receipt = await evmScriptReg.addScriptExecutor(scriptExecutorMock.address, { from: boss })
        installedExecutorId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
      })

      it('can disable an executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        let executorEntry = await evmScriptReg.executors(installedExecutorId)
        assert.isTrue(executorEntry[1], "executor should be enabled")

        const receipt = await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })
        executorEntry = await evmScriptReg.executors(installedExecutorId)

        assertAmountOfEvents(receipt, 'DisableExecutor')
        assert.isFalse(executorEntry[1], "executor should now be disabled")
        assert.equal(await evmScriptReg.getScriptExecutor(createExecutorId(installedExecutorId)), ZERO_ADDR, 'getting disabled executor should return zero addr')
      })

      it('can re-enable an executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })
        let executorEntry = await evmScriptReg.executors(installedExecutorId)
        assert.isFalse(executorEntry[1], "executor should now be disabled")
        assert.equal(await evmScriptReg.getScriptExecutor(createExecutorId(installedExecutorId)), ZERO_ADDR, 'getting disabled executor should return zero addr')

        const receipt = await evmScriptReg.enableScriptExecutor(installedExecutorId, { from: boss })
        executorEntry = await evmScriptReg.executors(installedExecutorId)

        assertAmountOfEvents(receipt, 'EnableExecutor')
        assert.isTrue(executorEntry[1], "executor should now be re-enabled")
        assert.notEqual(await evmScriptReg.getScriptExecutor(createExecutorId(installedExecutorId)), ZERO_ADDR, 'getting disabled executor should return non-zero addr')
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

      it('fails to disable an already disabled executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })
        await evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss })

        await assertRevert(evmScriptReg.disableScriptExecutor(installedExecutorId, { from: boss }), reverts.EVMREG_EXECUTOR_DISABLED)
      })
    })

    context('> Non-existing executor', () => {
      it('fails to enable a non-existent executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        // 0 is reserved
        await assertRevert(evmScriptReg.enableScriptExecutor(0, { from: boss }), reverts.EVMREG_INEXISTENT_EXECUTOR)

        // No executors should be installed yet
        assert.equal(await evmScriptReg.getScriptExecutor(createExecutorId(1)), ZERO_ADDR, 'No executors should be installed yet')
        await assertRevert(evmScriptReg.enableScriptExecutor(1, { from: boss }), reverts.EVMREG_INEXISTENT_EXECUTOR)
      })

      it('fails to disable a non-existent executor', async () => {
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        assert.equal(await evmScriptReg.getScriptExecutor(createExecutorId(1)), ZERO_ADDR, 'No executors should be installed yet')
        await assertRevert(
          evmScriptReg.disableScriptExecutor(1, { from: boss }),
          // On disable only an enable check is performed as it doubles as an existence check
          reverts.EVMREG_EXECUTOR_DISABLED
        )
      })
    })
  })

  context('> ScriptRunner', () => {
    let scriptRunnerApp

    before(async () => {
      scriptRunnerAppBase = await AppStubScriptRunner.new()
    })

    beforeEach(async () => {
      const receipt = await dao.newAppInstance(SCRIPT_RUNNER_APP_ID, scriptRunnerAppBase.address, EMPTY_BYTES, false, { from: boss })
      scriptRunnerApp = AppStubScriptRunner.at(getNewProxyAddress(receipt))
      await scriptRunnerApp.initialize()
    })

    it('gets the correct executor registry from the app', async () => {
      const registryFromApp = await scriptRunnerApp.getEVMScriptRegistry()
      assert.equal(evmScriptReg.address, registryFromApp, 'app should return the same EVMScriptRegistry')
    })

    it('fails to execute if spec ID is 0', async () => {
      await assertRevert(scriptRunnerApp.runScript(createExecutorId(0)), reverts.EVMRUN_EXECUTOR_UNAVAILABLE)
    })

    it('fails to execute if spec ID is unknown', async () => {
      await assertRevert(scriptRunnerApp.runScript(createExecutorId(4)), reverts.EVMRUN_EXECUTOR_UNAVAILABLE)
    })

    context('> Uninitialized', () => {
      beforeEach(async () => {
        // Install mock executor onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        await evmScriptReg.addScriptExecutor(scriptExecutorMock.address, { from: boss })

        // Install new script runner app
        const receipt = await dao.newAppInstance(SCRIPT_RUNNER_APP_ID, scriptRunnerAppBase.address, EMPTY_BYTES, false, { from: boss })
        scriptRunnerApp = AppStubScriptRunner.at(getNewProxyAddress(receipt))
        // Explicitly don't initialize the scriptRunnerApp
      })

      it('fails to execute any executor', async () => {
        await assertRevert(scriptRunnerApp.runScript(createExecutorId(1)), reverts.INIT_NOT_INITIALIZED)
      })
    })

    context('> Registry actions', () => {
      let executorSpecId

      beforeEach(async () => {
        // Let boss enable and disable executors
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_MANAGER_ROLE, boss, { from: boss })

        // Install mock executor onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(scriptExecutorMock.address, { from: boss })

        executorSpecId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
      })

      it("can't execute disabled spec ID", async () => {
        await evmScriptReg.disableScriptExecutor(executorSpecId, { from: boss })

        await assertRevert(scriptRunnerApp.runScript(encodeCallScript([])), reverts.EVMRUN_EXECUTOR_UNAVAILABLE)
      })

      it('can execute once spec ID is re-enabled', async () => {
        // Disable then re-enable the executor
        await evmScriptReg.disableScriptExecutor(executorSpecId, { from: boss })
        await evmScriptReg.enableScriptExecutor(executorSpecId, { from: boss })

        await scriptRunnerApp.runScript(encodeCallScript([]))
      })
    })

    context('> Returned bytes', () => {
      beforeEach(async () => {
        // Install mock executor onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(scriptExecutorMock.address, { from: boss })

        // Sanity check it's at spec ID 1
        const executorSpecId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
        assert.equal(executorSpecId, 1, 'EVMScriptExecutorMock should be installed as spec ID 1')
      })

      it('properly returns if no bytes are returned from executor', async () => {
        // Only executes executor with bytes for spec ID
        const inputScript = createExecutorId(1)
        const receipt = await scriptRunnerApp.runScript(inputScript)

        // Check logs
        // The executor app always uses 0x for the input and the mock script executor should return
        // an empty bytes array if only the spec ID is given
        assertEvent(receipt, 'ScriptResult', { script: inputScript, input: EMPTY_BYTES, returnData: EMPTY_BYTES })
      })

      for (const inputBytes of [
        soliditySha3('test').slice(2, 10),                                       // bytes4
        soliditySha3('test').slice(2),                                           // bytes32
        `${soliditySha3('test').slice(2)}${soliditySha3('test2').slice(2, 10)}`, // bytes36
        `${soliditySha3('test').slice(2)}${soliditySha3('test2').slice(2)}`,     // bytes64
      ]) {
        it(`properly returns bytes (length: ${inputBytes.length / 2}) from executor`, async () => {
          const inputScript = `${createExecutorId(1)}${inputBytes}`
          const receipt = await scriptRunnerApp.runScript(inputScript)

          // Check logs
          // The executor app always uses 0x for the input and the mock script executor should return
          // the full input script since it's more than just the spec ID
          assertEvent(receipt, 'ScriptResult', { script: inputScript, input: EMPTY_BYTES, returnData: inputScript })
        })
      }

      it('properly allocates the free memory pointer after no bytes were returned from executor', async () => {
        const inputScript = createExecutorId(1)
        const receipt = await scriptRunnerApp.runScriptWithNewBytesAllocation(inputScript)

        // Check logs for returned bytes
        assertEvent(receipt, 'ReturnedBytes', { returnedBytes: EMPTY_BYTES })
      })

      it('properly allocates the free memory pointer after returning bytes from executor', async () => {
        const inputBytes = `${soliditySha3('test').slice(2)}${soliditySha3('mock').slice(2)}`
        // Adjust to completely fill a 32-byte words (64 in this case: 4 + 32 + 32 - 4)
        const inputScript = `${createExecutorId(1)}${inputBytes}`.slice(0, -8)
        const receipt = await scriptRunnerApp.runScriptWithNewBytesAllocation(inputScript)

        // Check logs for returned bytes
        assertEvent(receipt, 'ReturnedBytes', { returnedBytes: inputScript })
      })
    })

    context('> No return from script', () => {
      beforeEach(async () => {
        // Install mock executor onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(scriptExecutorNoReturnMock.address, { from: boss })

        // Sanity check it's at spec ID 1
        const executorSpecId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
        assert.equal(executorSpecId, 1, 'EVMScriptExecutorNoReturnMock should be installed as spec ID 1')
      })

      it('fails if not return data is returned for ABI-encoded bytes', async () => {
        const inputScript = createExecutorId(1)

        // Should revert with invalid return
        await assertRevert(scriptRunnerApp.runScript(inputScript), reverts.EVMRUN_EXECUTOR_INVALID_RETURN)
      })
    })

    context('> Reverted script', () => {
      beforeEach(async () => {
        // Install mock reverting executor onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(scriptExecutorRevertMock.address, { from: boss })

        // Sanity check it's at spec ID 1
        const executorSpecId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
        assert.equal(executorSpecId, 1, 'EVMScriptExecutorRevertMock should be installed as spec ID 1')
      })

      it('forwards the revert data correctly', async () => {
        // Only executes executor with bytes for spec ID
        const inputScript = createExecutorId(1)

        // Should revert and forward the script executor's revert message
        await assertRevert(scriptRunnerApp.runScript(inputScript), ERROR_MOCK_REVERT)
      })
    })

    context('> CallsScript', () => {
      let callsScriptBase, executionTarget

      beforeEach(async () => {
        callsScriptBase = await CallsScript.new()

        // Install CallsScript onto registry
        await acl.createPermission(boss, evmScriptReg.address, REGISTRY_ADD_EXECUTOR_ROLE, boss, { from: boss })
        const receipt = await evmScriptReg.addScriptExecutor(callsScriptBase.address, { from: boss })

        // Sanity check it's at spec ID 1
        const callsScriptExecutorId = getEventArgument(receipt, 'EnableExecutor', 'executorId')
        assert.equal(callsScriptExecutorId, 1, 'CallsScript should be installed as spec ID 1')

        executionTarget = await ExecutionTarget.new()
      })

      it('fails if directly calling calls script', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await assertRevert(callsScriptBase.execScript(script, EMPTY_BYTES, []), reverts.INIT_NOT_INITIALIZED)
      })

      it('is the correct executor type', async () => {
        const CALLS_SCRIPT_TYPE = soliditySha3('CALLS_SCRIPT')
        const executor = IEVMScriptExecutor.at(await evmScriptReg.getScriptExecutor(createExecutorId(1)))
        assert.equal(await executor.executorType(), CALLS_SCRIPT_TYPE)
      })

      it('gets the correct executor from the app', async () => {
        const script = createExecutorId(1)
        const executor = await evmScriptReg.getScriptExecutor(script)

        const scriptExecutor = await scriptRunnerApp.getEVMScriptExecutor(script)
        assert.equal(executor, scriptExecutor, 'app should return the same evm script executor')
      })

      it('executes single action script', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        const receipt = await scriptRunnerApp.runScript(script)

        assert.equal(await executionTarget.counter(), 1, 'should have executed action')

        // Check logs
        // The executor app always uses 0x for the input and the calls script always returns 0x output
        const expectedExecutor = await evmScriptReg.getScriptExecutor(createExecutorId(1))
        assertEvent(receipt, 'ScriptResult', { executor: expectedExecutor, script, input: EMPTY_BYTES, returnData: EMPTY_BYTES })
      })

      it("can execute if call doesn't contain blacklist addresses", async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await scriptRunnerApp.runScriptWithBan(script, ['0x1234'])

        assert.equal(await executionTarget.counter(), 1, 'should have executed action')
      })

      it('executes multi action script', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action, action, action, action])

        await scriptRunnerApp.runScript(script)

        assert.equal(await executionTarget.counter(), 4, 'should have executed multiple actions')
      })

      it('executes multi action script to multiple addresses', async () => {
        const executionTarget2 = await ExecutionTarget.new()

        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const action2 = { to: executionTarget2.address, calldata: executionTarget2.contract.execute.getData() }

        const script = encodeCallScript([action2, action, action2, action, action2])

        await scriptRunnerApp.runScript(script)

        assert.equal(await executionTarget.counter(), 2, 'should have executed action')
        assert.equal(await executionTarget2.counter(), 3, 'should have executed action')
      })

      it('executes with parameters', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.setCounter.getData(101) }
        const script = encodeCallScript([action])

        await scriptRunnerApp.runScript(script)

        assert.equal(await executionTarget.counter(), 101, 'should have set counter')
      })

      it('execution fails if one call fails', async () => {
        const action1 = { to: executionTarget.address, calldata: executionTarget.contract.setCounter.getData(101) }
        const action2 = { to: executionTarget.address, calldata: executionTarget.contract.failExecute.getData(true) }

        const script = encodeCallScript([action1, action2])

        await assertRevert(scriptRunnerApp.runScript(script), ERROR_EXECUTION_TARGET)
      })

      it('execution fails with correctly forwarded error data', async () => {
        const action1 = { to: executionTarget.address, calldata: executionTarget.contract.failExecute.getData(true) }

        const script = encodeCallScript([action1])

        await assertRevert(scriptRunnerApp.runScript(script), ERROR_EXECUTION_TARGET)
      })

      it('execution fails with default error data if no error data is returned', async () => {
        const action1 = { to: executionTarget.address, calldata: executionTarget.contract.failExecute.getData(false) }

        const script = encodeCallScript([action1])

        await assertRevert(scriptRunnerApp.runScript(script), reverts.EVMCALLS_CALL_REVERTED)
      })

      it('can execute empty script', async () => {
        await scriptRunnerApp.runScript(encodeCallScript([]))
      })

      it('fails to execute if has blacklist addresses being called', async () => {
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await assertRevert(scriptRunnerApp.runScriptWithBan(script, [executionTarget.address]), reverts.EVMCALLS_BLACKLISTED_CALL)
      })

      context('> Script underflow', () => {
        const encodeCallScriptAddressUnderflow = actions => {
          return actions.reduce((script, { to }) => {
            const addr = rawEncode(['address'], [to]).toString('hex')

            // Remove too much of the address (should just remove first 12 0s of padding as addr)
            return script + addr.slice(24 + 4)
          }, createExecutorId(1)) // spec 1
        }

        const encodeCallScriptCalldataUnderflow = actions => {
          return actions.reduce((script, { to, calldata }) => {
            const addr = rawEncode(['address'], [to]).toString('hex')
            const length = rawEncode(['uint256'], [calldata.length]).toString('hex')

            // Remove too much of the calldataLength (should just remove first 28 0s of padding as uint32)
            return script + addr.slice(24) + length.slice(56 + 4)
          }, createExecutorId(1)) // spec 1
        }

        it('fails if data length is too small to contain address', async () => {
          const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
          const script = encodeCallScriptAddressUnderflow([action])

          // EVMScriptRunner doesn't pass through the revert yet
          await assertRevert(scriptRunnerApp.runScript(script), reverts.EVMCALLS_INVALID_LENGTH)
        })

        it('fails if data length is too small to contain calldata', async () => {
          const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
          const script = encodeCallScriptCalldataUnderflow([action])

          // EVMScriptRunner doesn't pass through the revert yet
          await assertRevert(scriptRunnerApp.runScript(script), reverts.EVMCALLS_INVALID_LENGTH)
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
          }, createExecutorId(1)) // spec 1
        }

        it('fails if data length is too big', async () => {
          const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
          const script = encodeCallScriptCalldataOverflow([action])

          // EVMScriptRunner doesn't pass through the revert yet
          await assertRevert(scriptRunnerApp.runScript(script), reverts.EVMCALLS_INVALID_LENGTH)
        })
      })
    })
  })
})
