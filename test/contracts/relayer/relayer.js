const { sha3, soliditySha3 } = require('web3-utils')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument, getNewProxyAddress } = require('../../helpers/events')
const { assertEvent, assertAmountOfEvents } = require('../../helpers/assertEvent')(web3)

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const Relayer = artifacts.require('RelayerMock')
const DAOFactory = artifacts.require('DAOFactory')
const SampleApp = artifacts.require('RelayedAppMock')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

contract('Relayer', ([_, root, member, anyone, vault, offChainRelayerService]) => {
  let daoFactory, dao, acl, app, relayer, nextNonce = 1
  let kernelBase, aclBase, sampleAppBase, relayerBase
  let WRITING_ROLE, APP_MANAGER_ROLE, ALLOW_OFF_CHAIN_SERVICE_ROLE, DISALLOW_OFF_CHAIN_SERVICE_ROLE, RELAYER_APP_ID

  const GAS_PRICE = 1e9
  const MONTHLY_REFUND_GAS = 1e6 * 5
  const MONTHLY_REFUND_QUOTA = MONTHLY_REFUND_GAS * GAS_PRICE

  before('deploy base implementations', async () => {
    aclBase = await ACL.new()
    kernelBase = await Kernel.new(true) // petrify immediately
    relayerBase = await Relayer.new()
    sampleAppBase = await SampleApp.new()
    daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x0')
  })

  before('load constants', async () => {
    RELAYER_APP_ID = await kernelBase.DEFAULT_RELAYER_APP_ID()
    WRITING_ROLE = await sampleAppBase.WRITING_ROLE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    ALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.ALLOW_OFF_CHAIN_SERVICE_ROLE()
    DISALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.DISALLOW_OFF_CHAIN_SERVICE_ROLE()
  })

  before('deploy DAO', async () => {
    const receipt = await daoFactory.newDAO(root)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
  })

  before('create relayer instance', async () => {
    const receipt = await dao.newAppInstance(RELAYER_APP_ID, relayerBase.address, '0x', true, { from: root })
    relayer = Relayer.at(getNewProxyAddress(receipt))
    await relayer.initialize(MONTHLY_REFUND_QUOTA)

    await acl.createPermission(root, relayer.address, ALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, DISALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
    await relayer.allowService(offChainRelayerService, { from: root })
  })

  beforeEach('create sample app instance', async () => {
    const receipt = await dao.newAppInstance('0x22222', sampleAppBase.address, '0x', false, { from: root })
    app = SampleApp.at(getNewProxyAddress(receipt))
    await app.initialize()

    await acl.createPermission(member, app.address, WRITING_ROLE, root, { from: root })
  })

  beforeEach('increment nonce and time by one month', async () => {
    nextNonce++
    await relayer.mockIncreaseTime(60 * 60 * 24 * 31)
  })

  describe('relay', () => {
    let calldata, signature, gasRefund = 50000

    context('when the sender is an allowed service', () => {
      const from = offChainRelayerService

      context('when the signature valid', () => {
        context('when the sender is authorized', () => {
          const sender = member

          context('when the nonce is not used', () => {
            context('when the sender can refund requested gas amount', () => {
              beforeEach('build tx data', async () => {
                calldata = app.contract.write.getData(10)
                const messageHash = soliditySha3(app.address, nextNonce, sha3(calldata), gasRefund, GAS_PRICE)
                signature = web3.eth.sign(sender, messageHash)
              })

              context('when the relayer does not have funds', () => {
                it('reverts', async () => {
                  await assertRevert(relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_GAS_REFUND_FAIL')
                })
              })

              context('when the relayer has funds', () => {
                before('fund relayer', async () => {
                  const SEND_ETH_GAS = 31000 // 21k base tx cost + 10k limit on depositable proxies
                  await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
                })

                it('relays transactions to app', async () => {
                  await relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from })
                  assert.equal((await app.read()).toString(), 10, 'app value does not match')
                })

                it('refunds the off-chain service', async () => {
                  const previousRelayerBalance = await web3.eth.getBalance(relayer.address)
                  const previousServiceBalance = await web3.eth.getBalance(offChainRelayerService)

                  const { tx, receipt: { gasUsed } } = await relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from })
                  const { gasPrice: gasPriceUsed } = await web3.eth.getTransaction(tx)

                  const txRefund = gasRefund * GAS_PRICE
                  const realTxCost = gasPriceUsed.mul(gasUsed)

                  const currentRelayerBalance = await web3.eth.getBalance(relayer.address)
                  const currentServiceBalance = await web3.eth.getBalance(offChainRelayerService)

                  assert.equal(currentRelayerBalance.toString(), previousRelayerBalance.minus(txRefund).toString())
                  assert.equal(currentServiceBalance.toString(), previousServiceBalance.minus(realTxCost).plus(txRefund).toString())
                })

                it('updates the last nonce and refunds of the signer', async () => {
                  const previousTotalRefunds = await relayer.getTotalRefunds(sender)
                  await relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from })

                  assert.isTrue(await relayer.isNonceUsed(sender, nextNonce), 'last nonce should have been updated')
                  assert.isFalse(await relayer.isNonceUsed(sender, nextNonce + 1), 'next nonce should not be used')

                  const txRefund = gasRefund * GAS_PRICE
                  const currentTotalRefunds = await relayer.getTotalRefunds(sender)
                  assert.equal(previousTotalRefunds.toString(), currentTotalRefunds.minus(txRefund).toString(), 'total refunds should have been updated')
                })

                it.only('emits an event', async () => {
                  const receipt = await relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from })

                  assertAmountOfEvents(receipt, 'TransactionRelayed')
                  assertEvent(receipt, 'TransactionRelayed', { from: sender, to: app.address, nonce: nextNonce, calldata })
                })

                it.only('overloads a transaction with ~50k of gas', async () => {
                  const { receipt: { cumulativeGasUsed: relayedGasUsed } } = await relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from })
                  const { receipt: { cumulativeGasUsed: nonRelayerGasUsed } } = await app.write(10, { from: sender })

                  const gasOverload = relayedGasUsed - nonRelayerGasUsed
                  console.log('relayedGasUsed:', relayedGasUsed)
                  console.log('nonRelayerGasUsed:', nonRelayerGasUsed)
                  console.log('gasOverload:', gasOverload)

                  assert.isBelow(gasOverload, 50000, 'relayed txs gas overload is higher than 50k')
                })
              })
            })

            context('when the sender can not refund requested gas amount', () => {
              const hugeGasRefund = MONTHLY_REFUND_QUOTA + 1

              beforeEach('build tx data', async () => {
                calldata = app.contract.write.getData(10)
                const messageHash = soliditySha3(app.address, nextNonce, sha3(calldata), hugeGasRefund, GAS_PRICE)
                signature = web3.eth.sign(sender, messageHash)
              })

              it('reverts', async () => {
                await assertRevert(relayer.relay(sender, app.address, nextNonce, calldata, hugeGasRefund, GAS_PRICE, signature, { from }), 'RELAYER_GAS_QUOTA_EXCEEDED')
              })
            })
          })

          context('when the nonce is already used', () => {
            beforeEach('build tx data', async () => {
              calldata = app.contract.write.getData(10)
              const messageHash = soliditySha3(app.address, nextNonce - 3, sha3(calldata), gasRefund, GAS_PRICE)
              signature = web3.eth.sign(sender, messageHash)
            })

            it('reverts', async () => {
              await assertRevert(relayer.relay(sender, app.address, nextNonce - 3, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_NONCE_ALREADY_USED')
            })
          })
        })

        context('when the sender is not authorized', () => {
          const sender = anyone

          it('reverts', async () => {
            calldata = app.contract.write.getData(10)
            const messageHash = soliditySha3(app.address, nextNonce, sha3(calldata), gasRefund, GAS_PRICE)
            signature = web3.eth.sign(sender, messageHash)

            await assertRevert(relayer.relay(sender, app.address, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'APP_AUTH_FAILED')
          })
        })
      })

      context('when the signature is not valid', () => {
        calldata = '0x0'

        context('when the sender is authorized', () => {
          const sender = member

          it('reverts', async () => {
            const messageHash = soliditySha3("bla")
            const signature = web3.eth.sign(sender, messageHash)

            await assertRevert(relayer.relay(sender, anyone, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_INVALID_SENDER_SIGNATURE')
          })
        })

        context('when the sender is not authorized', () => {
          const sender = anyone

          it('reverts', async () => {
            const messageHash = soliditySha3("bla")
            const signature = web3.eth.sign(sender, messageHash)

            await assertRevert(relayer.relay(sender, anyone, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_INVALID_SENDER_SIGNATURE')
          })
        })
      })
    })

    context('when the sender is not an allowed service', () => {
      calldata = '0x0'
      const from = anyone

      it('reverts', async () => {
        await assertRevert(relayer.relay(member, anyone, nextNonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_SERVICE_NOT_ALLOWED')
      })
    })
  })

  describe('getLastUsedNonce', () => {
    context('when the given sender has already sent some transactions', () => {
      const account = member

      it('returns the last nonce', async () => {
        assert.isTrue((await relayer.getLastUsedNonce(account)).gt(0), 'last nonce does not match')
      })
    })

    context('when the given sender did not send transactions yet', () => {
      const account = anyone

      it('returns zero', async () => {
        assert.equal(await relayer.getLastUsedNonce(account), 0, 'last nonce does not match')
      })
    })
  })

  describe('isNonceUsed', () => {
    const sender = member

    context('when the requested nonce is zero', () => {
      const nonce = 0

      context('when the requested sender is the actual sender', () => {
        const account = sender

        it('returns true', async () => {
          assert.isTrue(await relayer.isNonceUsed(account, nonce), 'nonce should be used')
        })
      })

      context('when the requested sender is another account', () => {
        const account = anyone

        it('returns true', async () => {
          assert.isTrue(await relayer.isNonceUsed(account, nonce), 'nonce should be used')
        })
      })
    })

    context('when the requested nonce is greater than zero but lower than the nonce used', () => {
      const nonce = 1

      context('when the requested sender is the actual sender', () => {
        const account = sender

        it('returns true', async () => {
          assert.isTrue(await relayer.isNonceUsed(account, nonce), 'nonce should be used')
        })
      })

      context('when the requested sender is another account', () => {
        const account = anyone

        it('returns false', async () => {
          assert.isFalse(await relayer.isNonceUsed(account, nonce), 'nonce should not be used')
        })
      })
    })

    context('when the requested nonce is equal to the nonce used', () => {
      let nonce

      beforeEach('set nonce', async () => nonce = await relayer.getLastUsedNonce(sender))

      context('when the requested sender is the actual sender', () => {
        const account = sender

        it('returns true', async () => {
          assert.isTrue(await relayer.isNonceUsed(account, nonce), 'nonce should be used')
        })
      })

      context('when the requested sender is another account', () => {
        const account = anyone

        it('returns false', async () => {
          assert.isFalse(await relayer.isNonceUsed(account, nonce), 'nonce should not be used')
        })
      })
    })

    context('when the requested nonce is greater than the nonce used', () => {
      let nonce

      beforeEach('set nonce', async () => nonce = (await relayer.getLastUsedNonce(sender)).plus(1))

      context('when the requested sender is the actual sender', () => {
        const account = sender

        it('returns false', async () => {
          assert.isFalse(await relayer.isNonceUsed(account, nonce), 'nonce should not be used')
        })
      })

      context('when the requested sender is another account', () => {
        const account = anyone

        it('returns false', async () => {
          assert.isFalse(await relayer.isNonceUsed(account, nonce), 'nonce should not be used')
        })
      })
    })
  })

  describe('getTotalRefunds', () => {
    context('when the given sender has already sent some transactions', () => {
      const account = member

      it('returns the total refunds amount', async () => {
        assert.isTrue((await relayer.getTotalRefunds(account)).gt(0), 'total refunds do not match')
      })
    })

    context('when the given sender did not send transactions yet', () => {
      const account = anyone

      it('returns zero', async () => {
        assert.equal(await relayer.getTotalRefunds(account), 0, 'total refunds do not match')
      })
    })
  })

  describe('canRefund', () => {
    let remainingRefunds
    const sender = member

    beforeEach('fetch total refunds', async () => {
      remainingRefunds = new web3.BigNumber(MONTHLY_REFUND_QUOTA).minus(await relayer.getTotalRefunds(sender))
    })

    context('when the requested amount does not exceed the monthly quota', () => {
      it('returns true', async () => {
        assert.isTrue(await relayer.canRefund(sender, remainingRefunds.minus(1)), 'should be allowed to spend amount')
      })
    })

    context('when the requested amount is equal to the monthly quota', () => {
      it('returns true', async () => {
        assert.isTrue(await relayer.canRefund(sender, remainingRefunds), 'should be allowed to spend amount')
      })
    })

    context('when the requested amount is greater than the monthly quota', () => {
      it('returns true', async () => {
        assert.isTrue(await relayer.canRefund(sender, remainingRefunds.plus(1)), 'should not be allowed to spend amount')
      })
    })
  })

  describe('isDepositable', () => {
    it('returns true', async () => {
      assert.isTrue(await relayer.isDepositable(), 'should be depositable')
    })
  })

  describe('allowRecoverability', () => {
    context('when the token is ETH', () => {
      it('returns false', async () => {
        assert.isFalse(await relayer.allowRecoverability(ZERO_ADDRESS), 'should not allow ETH recoverability')
      })
    })

    context('when the token is not ETH', () => {
      it('returns true', async () => {
        assert.isTrue(await relayer.allowRecoverability(anyone), 'should allow tokens recoverability')
      })
    })
  })

  describe('allowService', () => {
    context('when the sender is allowed', () => {
      const from = root

      it('adds a new allowed service', async () => {
        await relayer.allowService(anyone, { from })

        assert(await relayer.isServiceAllowed(anyone), 'service should be allowed')
      })

      it('emits an event', async () => {
        const receipt = await relayer.allowService(anyone, { from })

        assertAmountOfEvents(receipt, 'ServiceAllowed')
        assertEvent(receipt, 'ServiceAllowed', { service: anyone })
      })
    })

    context('when the sender is not allowed', () => {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(relayer.allowService(anyone, { from }), 'APP_AUTH_FAILED')
      })
    })
  })

  describe('disallowService', () => {
    context('when the sender is allowed', () => {
      const from = root

      it('adds a new allowed service', async () => {
        await relayer.disallowService(anyone, { from })

        assert.isFalse(await relayer.isServiceAllowed(anyone), 'service should not be allowed')
      })

      it('emits an event', async () => {
        const receipt = await relayer.disallowService(anyone, { from })

        assertAmountOfEvents(receipt, 'ServiceDisallowed')
        assertEvent(receipt, 'ServiceDisallowed', { service: anyone })
      })
    })

    context('when the sender is not allowed', () => {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(relayer.disallowService(anyone, { from }), 'APP_AUTH_FAILED')
      })
    })
  })
})
