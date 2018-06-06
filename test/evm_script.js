const { rawEncode } = require('ethereumjs-abi')

const { assertRevert } = require('./helpers/assertThrow')
const { encodeCallScript } = require('./helpers/evmScript')

const ExecutionTarget = artifacts.require('ExecutionTarget')
const Executor = artifacts.require('Executor')

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

    it('factory registered just 1 script executor', async () => {
        const zeroAddr = '0x0000000000000000000000000000000000000000'

        assert.equal(await reg.getScriptExecutor('0x00000000'), zeroAddr)
        assert.notEqual(await reg.getScriptExecutor('0x00000001'), zeroAddr)
        assert.equal(await reg.getScriptExecutor('0x00000002'), zeroAddr)
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
            await acl.grantPermission(boss, reg.address, await reg.REGISTRY_MANAGER_ROLE(), { from: boss })
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
    })
})
