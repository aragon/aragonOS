const { rawEncode } = require('ethereumjs-abi')
const { soliditySha3 } = require('web3-utils')

const assertEvent = require('./helpers/assertEvent')
const { assertRevert } = require('./helpers/assertThrow')
const { encodeCallScript } = require('./helpers/evmScript')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const CallsScript = artifacts.require('CallsScript')
const IEVMScriptExecutor = artifacts.require('IEVMScriptExecutor')

// Mocks
const ExecutionTarget = artifacts.require('ExecutionTarget')
const EVMScriptExecutorMock = artifacts.require('EVMScriptExecutorMock')
const AppStubScriptExecutor = artifacts.require('AppStubScriptExecutor')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract('EVM Script', accounts => {
    let callsScriptBase, executorAppBase, executorApp, executionTarget, dao, daoFact, reg, acl
    let APP_BASES_NAMESPACE

    const boss = accounts[1]

    const executorAppId = '0x1234'

    before(async () => {
        const regFact = await EVMScriptRegistryFactory.new()
        callsScriptBase = CallsScript.at(await regFact.baseCallScript())

        const kernelBase = await Kernel.new(true) // petrify immediately
        const aclBase = await ACL.new()
        daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)

        APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    })

    beforeEach(async () => {
        const receipt = await daoFact.newDAO(boss)
        dao = Kernel.at(receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao)
        acl = ACL.at(await dao.acl())
        reg = EVMScriptRegistry.at(receipt.logs.filter(l => l.event == 'DeployEVMScriptRegistry')[0].args.reg)

        await acl.createPermission(boss, dao.address, await dao.APP_MANAGER_ROLE(), boss, { from: boss })
        executorAppBase = await AppStubScriptExecutor.new()
        await dao.setApp(APP_BASES_NAMESPACE, executorAppId, executorAppBase.address, { from: boss })
    })

    it('factory registered just 1 script executor', async () => {
        assert.equal(await reg.getScriptExecutor('0x00000000'), ZERO_ADDR)
        assert.notEqual(await reg.getScriptExecutor('0x00000001'), ZERO_ADDR)
        assert.equal(await reg.getScriptExecutor('0x00000002'), ZERO_ADDR)
    })

    it('fails if directly calling base executor', async () => {
        const executionTarget = await ExecutionTarget.new()
        const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
        const script = encodeCallScript([action])

        await assertRevert(() => callsScriptBase.execScript(script, '0x', []))
    })

    context('> Registry', () => {
        it('is initialized', async () => {
            assert.isTrue(await reg.hasInitialized(), "should be initialized")
        })

        it('fails if reinitializing registry', async () => {
            await assertRevert(async () => {
                await reg.initialize()
            })
        })

        it('fails to get an executor if not enough bytes are given', async () => {
            await assertRevert(async () => {
                // Not enough bytes are given (need 4, given 3)
                await reg.getScriptExecutor('0x'.padEnd(6, 0))
            })
        })

        context('> New executor', () => {
            let executorMock, newExecutorId

            before(async () => {
                executorMock = await EVMScriptExecutorMock.new()
            })

            beforeEach(async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_ADD_EXECUTOR_ROLE(), boss, { from: boss })
                const receipt = await reg.addScriptExecutor(executorMock.address, { from: boss })

                newExecutorId = receipt.logs.filter(l => l.event == 'EnableExecutor')[0].args.executorId
            })

            it('can add a new executor', async () => {
                const executorEntry = await reg.executors(newExecutorId)
                const newExecutor = IEVMScriptExecutor.at(executorEntry[0])

                assert.equal(await executorMock.executorType(), await newExecutor.executorType(), "executor type should be the same")
                // Enabled flag is second in struct
                assert.isTrue(executorEntry[1], "new executor should be enabled")
            })

            it('can disable an executor', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })

                let executorEntry = await reg.executors(newExecutorId)
                assert.isTrue(executorEntry[1], "executor should be enabled")

                const receipt = await reg.disableScriptExecutor(newExecutorId, { from: boss })
                executorEntry = await reg.executors(newExecutorId)

                assertEvent(receipt, 'DisableExecutor')
                assert.isFalse(executorEntry[1], "executor should now be disabled")
                assert.equal(await reg.getScriptExecutor(`0x0000000${newExecutorId}`), ZERO_ADDR, 'getting disabled executor should return zero addr')
            })

            it('can re-enable an executor', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })

                await reg.disableScriptExecutor(newExecutorId, { from: boss })
                let executorEntry = await reg.executors(newExecutorId)
                assert.isFalse(executorEntry[1], "executor should now be disabled")
                assert.equal(await reg.getScriptExecutor(`0x0000000${newExecutorId}`), ZERO_ADDR, 'getting disabled executor should return zero addr')

                const receipt = await reg.enableScriptExecutor(newExecutorId, { from: boss })
                executorEntry = await reg.executors(newExecutorId)

                assertEvent(receipt, 'EnableExecutor')
                assert.isTrue(executorEntry[1], "executor should now be re-enabled")
                assert.notEqual(await reg.getScriptExecutor(`0x0000000${newExecutorId}`), ZERO_ADDR, 'getting disabled executor should return non-zero addr')
            })

            it('fails to add a new executor without the correct permissions', async () => {
                await assertRevert(async () => {
                    await reg.addScriptExecutor(executorMock.address)
                })
            })

            it('fails to disable an executor without the correct permissions', async () => {
                await assertRevert(async () => {
                    await reg.disableScriptExecutor(newExecutorId)
                })
            })

            it('fails to enable an executor without the correct permissions', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })
                await reg.disableScriptExecutor(newExecutorId, { from: boss })

                await assertRevert(async () => {
                    await reg.enableScriptExecutor(newExecutorId)
                })
            })

            it('fails to enable an already enabled executor', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })
                await assertRevert(async () => {
                    await reg.enableScriptExecutor(newExecutorId, { from: boss })
                })
            })

            it('fails to enable a non-existent executor', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })
                await assertRevert(async () => {
                    await reg.enableScriptExecutor(newExecutorId + 1, { from: boss })
                })
            })

            it('fails to disable an already disabled executor', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })
                await reg.disableScriptExecutor(newExecutorId, { from: boss })

                await assertRevert(async () => {
                    await reg.disableScriptExecutor(newExecutorId, { from: boss })
                })
            })
        })
    })

    context('> Uninitialized executor', () => {
        beforeEach(async () => {
            const receipt = await dao.newAppInstance(executorAppId, executorAppBase.address, '0x', false, { from: boss })
            executorApp = AppStubScriptExecutor.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
            // Explicitly don't initialize the executorApp
            executionTarget = await ExecutionTarget.new()
        })

        it('fails to execute any executor', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])

            await assertRevert(() => executorApp.execute(script))
        })
    })

    context('> Executor', () => {
        beforeEach(async () => {
            const receipt = await dao.newAppInstance(executorAppId, executorAppBase.address, '0x', false, { from: boss })
            executorApp = AppStubScriptExecutor.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
            await executorApp.initialize()
            executionTarget = await ExecutionTarget.new()
        })

        it('gets the correct executor registry from the app', async () => {
            const appRegistry = await executorApp.getEVMScriptRegistry()
            assert.equal(reg.address, appRegistry, 'app should return the same evm script registry')
        })

        it('fails to execute if spec ID is 0', async () => {
            return assertRevert(async () => {
                await executorApp.execute('0x00000000')
            })
        })

        it('fails to execute if spec ID is unknown', async () => {
            return assertRevert(async () => {
                await executorApp.execute('0x00000004')
            })
        })

        context('> CallsScript (Spec ID 1)', () => {
            it('is the correct executor type', async () => {
                const CALLS_SCRIPT_TYPE = soliditySha3('CALLS_SCRIPT')
                const executor = IEVMScriptExecutor.at(await reg.getScriptExecutor('0x00000001'))
                assert.equal(await executor.executorType(), CALLS_SCRIPT_TYPE)
            })

            it('gets the correct executor from the app', async () => {
                const CALLS_SCRIPT_TYPE = soliditySha3('CALLS_SCRIPT')
                const script = '0x00000001'
                const executor = await reg.getScriptExecutor(script)

                const appExecutor = await executorApp.getEVMScriptExecutor(script)
                assert.equal(executor, appExecutor, 'app should return the same evm script executor')
            })

            it('executes single action script', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action])

                const receipt = await executorApp.execute(script)

                assert.equal(await executionTarget.counter(), 1, 'should have executed action')

                // Check logs
                // The Executor always uses 0x for the input and callscripts always have 0x returns
                const scriptResult = receipt.logs.filter(l => l.event == 'ScriptResult')[0]
                assert.equal(scriptResult.args.executor, await reg.getScriptExecutor('0x00000001'), 'should log the same executor')
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

                return assertRevert(async () => {
                    await executorApp.execute(script)
                })
            })

            it('can execute empty script', async () => {
                await executorApp.execute(encodeCallScript([]))
            })

            it('fails to execute if has blacklist addresses being called', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action])

                return assertRevert(async () => {
                    await executorApp.executeWithBan(script, [executionTarget.address])
                })
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

                    return assertRevert(async () => {
                        await executorApp.execute(script)
                    })
                })

                it('fails if data length is too small to contain calldata', async () => {
                    const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                    const script = encodeCallScriptCalldataUnderflow([action])

                    return assertRevert(async () => {
                        await executorApp.execute(script)
                    })
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

                    return assertRevert(async () => {
                        await executorApp.execute(script)
                    })
                })
            })
        })

        context('> Registry actions', () => {
            it("can execute disabled spec ID", async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })
                await reg.disableScriptExecutor(1, { from: boss })

                return assertRevert(async () => {
                    await executorApp.execute(encodeCallScript([]))
                })
            })

            it('can execute once spec ID is re-enabled', async () => {
                await acl.createPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), boss, { from: boss })

                // Disable then re-enable the executor
                await reg.disableScriptExecutor(1, { from: boss })
                await reg.enableScriptExecutor(1, { from: boss })

                await executorApp.execute(encodeCallScript([]))
            })
        })
    })
})
