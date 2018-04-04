const { rawEncode } = require('ethereumjs-abi')

const { assertRevert } = require('./helpers/assertThrow')
const { encodeCallScript, encodeDelegate, encodeDeploy } = require('./helpers/evmScript')

const ExecutionTarget = artifacts.require('ExecutionTarget')
const Executor = artifacts.require('Executor')
const Delegator = artifacts.require('Delegator')
const FailingDelegator = artifacts.require('FailingDelegator')
const DyingDelegator = artifacts.require('DyingDelegator')
const FailingDeployment = artifacts.require('FailingDeployment')
const MockDyingScriptExecutor = artifacts.require('MockDyingScriptExecutor')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const EVMScriptRegistryConstants = artifacts.require('EVMScriptRegistryConstants')
const IEVMScriptExecutor = artifacts.require('IEVMScriptExecutor')

const keccak256 = require('js-sha3').keccak_256
const APP_BASE_NAMESPACE = '0x'+keccak256('base')

const getContract = artifacts.require

contract('EVM Script', accounts => {
    let executor, executionTarget, dao, daoFact, reg, constants, acl = {}, baseExecutor

    const boss = accounts[1]

    const executorAppId = '0x1234'

    before(async () => {
        const regFact = await EVMScriptRegistryFactory.new()

        const kernelBase = await getContract('Kernel').new()
        const aclBase = await getContract('ACL').new()
        daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)

        constants = await EVMScriptRegistryConstants.new()
    })

    beforeEach(async () => {
        const receipt = await daoFact.newDAO(boss)
        dao = Kernel.at(receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao)
        acl = ACL.at(await dao.acl())
        reg = EVMScriptRegistry.at(receipt.logs.filter(l => l.event == 'DeployEVMScriptRegistry')[0].args.reg)

        await acl.createPermission(boss, dao.address, await dao.APP_MANAGER_ROLE(), boss, { from: boss })
        baseExecutor = await Executor.new()
        await dao.setApp(APP_BASE_NAMESPACE, executorAppId, baseExecutor.address, { from: boss })
    })

    it('registered just 3 script executors', async () => {
        const zeroAddr = '0x0000000000000000000000000000000000000000'

        assert.equal(await reg.getScriptExecutor('0x00000000'), zeroAddr)
        assert.notEqual(await reg.getScriptExecutor('0x00000001'), zeroAddr)
        assert.notEqual(await reg.getScriptExecutor('0x00000002'), zeroAddr)
        assert.notEqual(await reg.getScriptExecutor('0x00000003'), zeroAddr)
        assert.equal(await reg.getScriptExecutor('0x00000004'), zeroAddr)
    })

    it('fails if reinitializing registry', async () => {
        return assertRevert(async () => {
            await reg.initialize()
        })
    })

    context('executor', () => {
        beforeEach(async () => {
            const receipt = await dao.newAppInstance(executorAppId, baseExecutor.address, { from: boss })
            executor = Executor.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
            executionTarget = await ExecutionTarget.new()

            await acl.grantPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), { from: boss })
        })

        it('fails to execute if spec ID is 0', async () => {
            return assertRevert(async () => {
                await executor.execute('0x00000000')
            })
        })

        it('fails to execute if spec ID is unknown', async () => {
            return assertRevert(async () => {
                await executor.execute('0x00000004')
            })
        })

        it('can disable executors', async () => {
            await reg.disableScriptExecutor(1, { from: boss })
            return assertRevert(async () => {
                await executor.execute(encodeCallScript([]))
            })
        })

        context('spec ID 1', () => {
            it('executes single action script', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action])

                await executor.execute(script)

                assert.equal(await executionTarget.counter(), 1, 'should have executed action')
            })

            it('fails to execute if has blacklist addresses being called', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action])

                return assertRevert(async () => {
                    await executor.executeWithBan(script, [executionTarget.address])
                })
            })

            it('can execute if call doesnt cointain blacklist addresses', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action])

                await executor.executeWithBan(script, ['0x1234'])

                assert.equal(await executionTarget.counter(), 1, 'should have executed action')
            })

            it('executes multi action script', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action, action, action, action])

                await executor.execute(script)

                assert.equal(await executionTarget.counter(), 4, 'should have executed action')
            })

            it('executes multi action script to multiple addresses', async () => {
                const executionTarget2 = await ExecutionTarget.new()

                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const action2 = { to: executionTarget2.address, calldata: executionTarget2.contract.execute.getData() }

                const script = encodeCallScript([action2, action, action2, action, action2])

                await executor.execute(script)

                assert.equal(await executionTarget.counter(), 2, 'should have executed action')
                assert.equal(await executionTarget2.counter(), 3, 'should have executed action')
            })

            it('executes with parameters', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.setCounter.getData(101) }
                const script = encodeCallScript([action])

                await executor.execute(script)

                assert.equal(await executionTarget.counter(), 101, 'should have set counter')
            })

            it('execution fails if one call fails', async () => {
                const action1 = { to: executionTarget.address, calldata: executionTarget.contract.setCounter.getData(101) }
                const action2 = { to: executionTarget.address, calldata: executionTarget.contract.failExecute.getData() }

                const script = encodeCallScript([action1, action2])

                return assertRevert(async () => {
                    await executor.execute(script)
                })
            })

            it('can execute empty script', async () => {
                await executor.execute(encodeCallScript([]))
            })
        })

        const delegatorResultNumber = 1234

        context('spec ID 2', () => {
            let delegator = {}
            before(async () => {
                delegator = await Delegator.new()
            })

            it('can execute delegated action', async () => {
                await executor.executeWithBan(encodeDelegate(delegator.address), [])

                assert.equal(await executor.randomNumber(), delegatorResultNumber, 'should have executed correctly')
            })

            it('can execute action with input and output', async () => {
                const value = 101
                const input = delegator.contract.execReturnValue.getData(value)
                const output = await executor.executeWithIO.call(encodeDelegate(delegator.address), input, [])

                assert.equal(new web3.BigNumber(output), value, 'return value should be correct')
            })

            it('fails to execute if it has blacklist addresses', async () => {
                return assertRevert(async () => {
                    await executor.executeWithBan(encodeDelegate(delegator.address), ['0x12'])
                })
            })

            it('fails if underlying call fails', async () => {
                const failingDelegator = await FailingDelegator.new()
                return assertRevert(async () => {
                    // extra gas to avoid oog
                    await executor.executeWithBan(encodeDelegate(failingDelegator.address), [], { gas: 2e6 })
                })
            })

            it('fails if underlying call selfdestructs', async () => {
                const dyingDelegator = await DyingDelegator.new()
                return assertRevert(async () => {
                    // extra gas to avoid oog
                    await executor.executeWithBan(encodeDelegate(dyingDelegator.address), [], { gas: 2e6 })
                })
            })

            it('fails if calling to non-contract', async () => {
                return assertRevert(async () => {
                    await executor.execute(encodeDelegate(accounts[0])) // addr is too small
                })
            })

            it('fails if payload is too small', async () => {
                return assertRevert(async () => {
                    await executor.execute(encodeDelegate('0x1234')) // addr is too small
                })
            })
        })

        context('spec ID 3', () => {
            it('can deploy and execute', async () => {
                await executor.execute(encodeDeploy(Delegator))

                assert.equal(await executor.randomNumber(), delegatorResultNumber, 'should have executed correctly')
            })

            it('can deploy action with input and output', async () => {
                const value = 102
                const delegator = await Delegator.new()
                const input = delegator.contract.execReturnValue.getData(value)
                const output = await executor.executeWithIO.call(encodeDeploy(Delegator), input, [])

                assert.equal(new web3.BigNumber(output), value, 'return value should be correct')
            })

            it('caches deployed contract and reuses it', async () => {
                const r1 = await executor.execute(encodeDeploy(Delegator))
                const r2 = await executor.execute(encodeDeploy(Delegator))

                assert.isBelow(r2.receipt.gasUsed, r1.receipt.gasUsed / 2, 'should have used less than half the gas because of cache')
                assert.equal(await executor.randomNumber(), delegatorResultNumber * 2, 'should have executed correctly twice')
            })

            it('fails if deployment fails', async () => {
                return assertRevert(async () => {
                    await executor.execute(encodeDeploy(FailingDeployment))
                })
            })

            it('fails if deployed contract doesnt have exec function', async () => {
                return assertRevert(async () => {
                    // random contract without exec() func
                    await executor.execute(encodeDeploy(ExecutionTarget))
                })
            })

            it('fails if exec function fails', async () => {
                return assertRevert(async () => {
                    await executor.execute(encodeDeploy(FailingDelegator))
                })
            })

            it('fails to execute if it has blacklist addresses', async () => {
                return assertRevert(async () => {
                    await executor.executeWithBan(encodeDeploy(Delegator), ['0x1234'])
                })
            })

            it('fails if execution modifies kernel', async () => {
                return assertRevert(async () => {
                    await executor.execute(encodeDeploy(artifacts.require('ProtectionModifierKernel')))
                })
            })

            it('fails if execution modifies app id', async () => {
                return assertRevert(async () => {
                    await executor.execute(encodeDeploy(artifacts.require('ProtectionModifierAppId')))
                })
            })
        })

        context('adding mock dying executor', () => {
            let dyingExecutor = null

            beforeEach(async () => {
                dyingExecutor = await MockDyingScriptExecutor.new()
                await reg.addScriptExecutor(dyingExecutor.address, { from: boss })
            })

            it('registers new executor', async () => {
                assert.equal(await reg.getScriptExecutor('0x00000004'), dyingExecutor.address)
            })

            it('executes mock executor', async () => {
                await executor.execute('0x00000004')
            })

            it('fails when executor selfdestructs', async () => {
                return assertRevert(async () => {
                    // passing some input makes executor to selfdestruct
                    await executor.executeWithIO('0x00000004', '0x0001', [])
                })
            })
        })

        context('script overflow', async () => {
            const encodeCallScriptBad = actions => {
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
                const script = encodeCallScriptBad([action])

                return assertRevert(async () => {
                    await executor.execute(script)
                })
            })
        })
    })

    context('isContract tests', async () => {
        let delegateScript

        before(async () => {
            delegateScript = await getContract('DelegateScriptWrapper').new()
        })

        it('fails if address is 0', async () => {
            assert.isFalse(await delegateScript.isContractWrapper('0x0'), "should return false")
        })

        it('fails if dst is not a contract', async () => {
            assert.isFalse(await delegateScript.isContractWrapper('0x1234'), "should return false")
        })
    })
})
