const { rawDecode } = require('ethereumjs-abi')

const { assertRevert } = require('./helpers/assertThrow')
const { encodeCallScript, encodeDelegate, encodeDeploy } = require('./helpers/evmScript')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const Executor = artifacts.require('Executor')
const Delegator = artifacts.require('Delegator')
const FailingDelegator = artifacts.require('FailingDelegator')
const FailingDeployment = artifacts.require('FailingDeployment')

contract('EVM Script', accounts => {
    let executor, executionTarget = {}

    beforeEach(async () => {
        executor = await Executor.new()
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

    context('spec ID 1', () => {
        it('executes single action script', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])

            await executor.execute(script)

            assert.equal(await executionTarget.counter(), 1, 'should have executed action')
        })

        it('fails to execute if has banned addresses being called', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])

            return assertRevert(async () => {
                await executor.executeWithBan(script, [executionTarget.address])
            })
        })

        it('can execute if call doesnt cointain banned addresses', async () => {
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

        it('decodes action count', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action, action, action, action])

            assert.equal(await executor.getActionsCount(script), 4, 'action count should be correct')
        })

        it('decodes actions', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action, action, action, action])

            const [to, calldata] = await executor.getAction(script, 2)

            assert.equal(action.to, to, 'action to should be correct')
            assert.equal(action.calldata, calldata, 'action calldata should be correct')
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

        it('fails to execute if it has banned addresses', async () => {
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
        it('can deploy an execute', async () => {
            await executor.execute(encodeDeploy(Delegator), { gas: 2e6 })

            assert.equal(await executor.randomNumber(), delegatorResultNumber, 'should have executed correctly')
        })

        it('can deploy action with input and output', async () => {
            const value = 102
            const delegator = await Delegator.new()
            const input = delegator.contract.execReturnValue.getData(value)
            const output = await executor.executeWithIO.call(encodeDeploy(Delegator), input, [])

            assert.equal(new web3.BigNumber(output), value, 'return value should be correct')
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

        it('fails to execute if it has banned addresses', async () => {
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
})
