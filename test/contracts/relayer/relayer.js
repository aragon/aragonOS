const { skipCoverage } = require('../../helpers/coverage')
const { sha3, soliditySha3 } = require('web3-utils')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument, getNewProxyAddress } = require('../../helpers/events')
const { assertEvent, assertAmountOfEvents } = require('../../helpers/assertEvent')(web3)

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const Relayer = artifacts.require('RelayerMock')
const DAOFactory = artifacts.require('DAOFactory')
const SampleApp = artifacts.require('RelayedAppMock')

const NOW = 1557945653
const ONE_MONTH = 60 * 60 * 24 * 30
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

contract('Relayer', ([_, root, member, someone, vault, offChainRelayerService]) => {
  let daoFactory, dao, acl, app, relayer
  let kernelBase, aclBase, sampleAppBase, relayerBase
  let WRITING_ROLE, APP_MANAGER_ROLE, SET_MONTHLY_REFUND_QUOTA_ROLE, ALLOW_OFF_CHAIN_SERVICE_ROLE, DISALLOW_OFF_CHAIN_SERVICE_ROLE, RELAYER_APP_ID

  const GAS_PRICE = 1e9
  const MONTHLY_REFUND_GAS = 1e6 * 5
  const MONTHLY_REFUND_QUOTA = MONTHLY_REFUND_GAS * GAS_PRICE

  const SEND_ETH_GAS = 31000 // 21k base tx cost + 10k limit on depositable proxies

  const signRelayedTx = ({ from, to, nonce, calldata = '0x0', gasRefund, gasPrice = GAS_PRICE }) => {
    const messageHash = soliditySha3(to, nonce, sha3(calldata), gasRefund, gasPrice)
    return web3.eth.sign(from, messageHash)
  }

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
    SET_MONTHLY_REFUND_QUOTA_ROLE = await relayerBase.SET_MONTHLY_REFUND_QUOTA_ROLE()
    ALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.ALLOW_OFF_CHAIN_SERVICE_ROLE()
    DISALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.DISALLOW_OFF_CHAIN_SERVICE_ROLE()
  })

  before('deploy DAO', async () => {
    const receipt = await daoFactory.newDAO(root)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
  })

  before('create sample app instance', async () => {
    const receipt = await dao.newAppInstance('0x22222', sampleAppBase.address, '0x', false, { from: root })
    app = SampleApp.at(getNewProxyAddress(receipt))
    await app.initialize()
    await acl.createPermission(member, app.address, WRITING_ROLE, root, { from: root })
  })

  beforeEach('create relayer instance', async () => {
    const receipt = await dao.newAppInstance(RELAYER_APP_ID, relayerBase.address, '0x', true, { from: root })
    relayer = Relayer.at(getNewProxyAddress(receipt))

    await relayer.mockSetTimestamp(NOW)

    await acl.createPermission(root, relayer.address, SET_MONTHLY_REFUND_QUOTA_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, ALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, DISALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
  })

  describe('initialize', () => {
    it('is not initialized by default', async () => {
      assert.isFalse(await relayer.hasInitialized(), 'should not be initialized')
    })

    it('initializes the relayer app correctly', async () => {
      await relayer.initialize(MONTHLY_REFUND_QUOTA)
      assert.isTrue(await relayer.hasInitialized(), 'should be initialized')
    })

    it('cannot be initialized again', async () => {
      await relayer.initialize(MONTHLY_REFUND_QUOTA)
      await assertRevert(relayer.initialize(MONTHLY_REFUND_QUOTA), 'INIT_ALREADY_INITIALIZED')
    })
  })

  describe('isDepositable', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      it('returns true', async () => {
        assert.isTrue(await relayer.isDepositable(), 'should be depositable')
      })
    })

    context('when the app is not initialized', () => {
      it('returns false', async () => {
        assert.isFalse(await relayer.isDepositable(), 'should not be depositable')
      })
    })
  })

  describe('allowRecoverability', () => {
    const itReturnsTrueUnlessETH = () => {
      context('when the token is ETH', () => {
        it('returns false', async () => {
          assert.isFalse(await relayer.allowRecoverability(ZERO_ADDRESS), 'should not allow ETH recoverability')
        })
      })

      context('when the token is not ETH', () => {
        it('returns true', async () => {
          assert.isTrue(await relayer.allowRecoverability(someone), 'should allow tokens recoverability')
        })
      })
    }

    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      itReturnsTrueUnlessETH()
    })

    context('when the app is initialized', () => {
      itReturnsTrueUnlessETH()
    })
  })

  describe('getStartDate', () => {
    context('when the app is initialized', () => {

      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      it('returns the start date', async () => {
        const startDate = await relayer.getStartDate()
        assert.equal(startDate.toString(), NOW, 'start date does not match')
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.getStartDate(), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('getMonthlyRefundQuota', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      it('returns the start date', async () => {
        const quota = await relayer.getMonthlyRefundQuota()
        assert.equal(quota.toString(), MONTHLY_REFUND_QUOTA, 'monthly refunds quota does not match')
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.getMonthlyRefundQuota(), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('getCurrentMonth', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when it has not passed a seconds since its initialization', () => {
        it('returns 0', async () => {
          const currentMonth = await relayer.getCurrentMonth()
          assert.equal(currentMonth.toString(), 0, 'current month quota does not match')
        })
      })

      context('when it has passed almost 30 days since its initialization', () => {
        beforeEach('increase time by almost 30 days', async () => await relayer.mockIncreaseTime(ONE_MONTH - 1))

        it('returns 0', async () => {
          const currentMonth = await relayer.getCurrentMonth()
          assert.equal(currentMonth.toString(), 0, 'current month quota does not match')
        })
      })

      context('when it has passed 30 days since its initialization', () => {
        beforeEach('increase time by 30 days', async () => await relayer.mockIncreaseTime(ONE_MONTH))

        it('returns 1', async () => {
          const currentMonth = await relayer.getCurrentMonth()
          assert.equal(currentMonth.toString(), 1, 'current month quota does not match')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.getCurrentMonth(), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('getLastUsedNonce', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the given sender did not send transactions yet', () => {
        it('returns zero', async () => {
          assert.equal((await relayer.getLastUsedNonce(member)).toString(), 0, 'last nonce does not match')
        })
      })

      context('when the given sender has already sent some transactions', () => {
        beforeEach('relay a transaction', async () => {
          const nonce = 2
          const calldata = '0x11111111'
          const gasRefund = 50000
          const signature = signRelayedTx({ from: member, to: someone, nonce, calldata, gasRefund })

          await relayer.allowService(offChainRelayerService, { from: root })
          await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
          await relayer.relay(member, someone, nonce, calldata, gasRefund, GAS_PRICE, signature, { from: offChainRelayerService })
        })

        it('returns the last nonce', async () => {
          assert.equal((await relayer.getLastUsedNonce(member)).toString(), 2, 'last nonce does not match')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.getLastUsedNonce(member), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('getMonthlyRefunds', () => {
    const month = 0

    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the given sender did not send transactions yet', () => {
        it('returns zero', async () => {
          assert.equal((await relayer.getMonthlyRefunds(member, month)).toString(), 0, 'monthly refunds do not match')
        })
      })

      context('when the given sender has already sent some transactions', () => {
        const gasRefund = 50000

        beforeEach('relay a transaction', async () => {
          const nonce = 2
          const calldata = '0x11111111'
          const signature = signRelayedTx({ from: member, to: someone, nonce, calldata, gasRefund })

          await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
          await relayer.allowService(offChainRelayerService, { from: root })
          await relayer.relay(member, someone, nonce, calldata, gasRefund, GAS_PRICE, signature, { from: offChainRelayerService })
        })

        it('returns the last nonce', async () => {
          assert.equal((await relayer.getMonthlyRefunds(member, month)).toString(), gasRefund * GAS_PRICE, 'monthly refunds do not match')
        })

        it('returns zero for the next month', async () => {
          assert.equal((await relayer.getMonthlyRefunds(member, month + 1)).toString(), 0, 'monthly refunds do not match')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.getMonthlyRefunds(member, month), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('isServiceAllowed', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the given address was allowed', () => {
        beforeEach('allow service', async () => await relayer.allowService(offChainRelayerService, { from: root }))

        context('when the given address is still allowed', () => {
          it('returns true', async () => {
            assert(await relayer.isServiceAllowed(offChainRelayerService), 'off chain service should be allowed')
          })
        })

        context('when the given address was already disallowed', () => {
          beforeEach('disallow service', async () => await relayer.disallowService(offChainRelayerService, { from: root }))

          it('returns false', async () => {
            assert.isFalse(await relayer.isServiceAllowed(offChainRelayerService), 'off chain service should be allowed')
          })
        })
      })

      context('when the given address was never allowed', () => {
        it('returns false', async () => {
          assert.isFalse(await relayer.isServiceAllowed(offChainRelayerService), 'off chain service should be allowed')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.isServiceAllowed(offChainRelayerService), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('canUseNonce', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the given sender did not send transactions yet', () => {
        context('when the requested nonce is zero', () => {
          const nonce = 0

          it('returns false', async () => {
            assert.isFalse(await relayer.canUseNonce(member, nonce), 'should not be allowed to use nonce zero')
          })
        })

        context('when the requested nonce is greater than zero', () => {
          const nonce = 1

          it('returns true', async () => {
            assert(await relayer.canUseNonce(member, nonce), 'should be allowed to use nonce')
          })
        })
      })

      context('when the given sender has already sent some transactions', () => {
        const usedNonce = 2

        beforeEach('relay a transaction', async () => {
          const calldata = '0x11111111'
          const gasRefund = 50000
          const signature = signRelayedTx({ from: member, to: someone, nonce: usedNonce, calldata, gasRefund })

          await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
          await relayer.allowService(offChainRelayerService, { from: root })
          await relayer.relay(member, someone, usedNonce, calldata, gasRefund, GAS_PRICE, signature, { from: offChainRelayerService })
        })

        context('when the requested nonce is zero', () => {
          const nonce = 0

          context('when the requested sender is the actual sender', () => {
            const sender = member

            it('returns false', async () => {
              assert.isFalse(await relayer.canUseNonce(sender, nonce), 'should not be allowed to use nonce zero')
            })
          })

          context('when the requested sender is another account', () => {
            const sender = someone

            it('returns false', async () => {
              assert.isFalse(await relayer.canUseNonce(sender, nonce), 'should not be allowed to use nonce zero')
            })
          })
        })

        context('when the requested nonce is greater than zero but lower than the nonce used', () => {
          const nonce = usedNonce - 1

          context('when the requested sender is the actual sender', () => {
            const sender = member

            it('returns false', async () => {
              assert.isFalse(await relayer.canUseNonce(sender, nonce), 'should not be allowed to use given nonce')
            })
          })

          context('when the requested sender is another account', () => {
            const sender = someone

            it('returns true', async () => {
              assert.isTrue(await relayer.canUseNonce(sender, nonce), 'should be allowed to use given nonce')
            })
          })
        })

        context('when the requested nonce is equal to the nonce used', () => {
          const nonce = usedNonce

          context('when the requested sender is the actual sender', () => {
            const sender = member

            it('returns false', async () => {
              assert.isFalse(await relayer.canUseNonce(sender, nonce), 'should not be allowed to use given nonce')
            })
          })

          context('when the requested sender is another account', () => {
            const sender = someone

            it('returns true', async () => {
              assert.isTrue(await relayer.canUseNonce(sender, nonce), 'should be allowed to use given nonce')
            })
          })
        })

        context('when the requested nonce is greater than the nonce used', () => {
          let nonce = usedNonce + 1

          context('when the requested sender is the actual sender', () => {
            const sender = member

            it('returns true', async () => {
              assert.isTrue(await relayer.canUseNonce(sender, nonce), 'should be allowed to use given nonce')
            })
          })

          context('when the requested sender is another account', () => {
            const sender = someone

            it('returns true', async () => {
              assert.isTrue(await relayer.canUseNonce(sender, nonce), 'should be allowed to use given nonce')
            })
          })
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.canUseNonce(member, 0), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('canRefund', () => {
    context('when the app is initialized', () => {
      let currentMonth

      beforeEach('initialize relayer app', async () => {
        await relayer.initialize(MONTHLY_REFUND_QUOTA)
        currentMonth = await relayer.getCurrentMonth()
      })

      context('when the given sender did not send transactions yet', () => {
        context('when the requested amount does not exceed the monthly quota', () => {
          const amount = MONTHLY_REFUND_QUOTA - 1

          it('returns true', async () => {
            assert(await relayer.canRefund(member, currentMonth, amount), 'should be allowed to spend given amount')
          })
        })

        context('when the requested amount is equal to the monthly quota', () => {
          const amount = MONTHLY_REFUND_QUOTA

          it('returns true', async () => {
            assert(await relayer.canRefund(member, currentMonth, amount), 'should be allowed to spend given amount')
          })
        })

        context('when the requested amount is greater than the monthly quota', () => {
          const amount = MONTHLY_REFUND_QUOTA + 1

          it('returns false', async () => {
            assert.isFalse(await relayer.canRefund(member, currentMonth, amount), 'should not be allowed to spend given amount')
          })
        })
      })

      context('when the given sender has already sent some transactions', () => {
        const gasRefund = 50000
        const monthlySpent = gasRefund * GAS_PRICE
        const remainingQuota = MONTHLY_REFUND_QUOTA - monthlySpent

        beforeEach('relay a transaction', async () => {
          const nonce = 1
          const calldata = '0x11111111'
          const signature = signRelayedTx({ from: member, to: someone, nonce, calldata, gasRefund })

          await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
          await relayer.allowService(offChainRelayerService, { from: root })
          await relayer.relay(member, someone, nonce, calldata, gasRefund, GAS_PRICE, signature, { from: offChainRelayerService })
        })

        context('when the asking for the current month', () => {
          context('when the requested amount does not exceed the remaining monthly quota', () => {
            const amount = remainingQuota - 1

            it('returns true', async () => {
              assert.isTrue(await relayer.canRefund(member, currentMonth, amount), 'should be allowed to spend amount')
            })
          })

          context('when the requested amount is equal to the remaining monthly quota', () => {
            const amount = remainingQuota

            it('returns true', async () => {
              assert.isTrue(await relayer.canRefund(member, currentMonth, amount), 'should be allowed to spend amount')
            })
          })

          context('when the requested amount is greater than the remaining monthly quota', () => {
            const amount = remainingQuota + 1

            it('returns false', async () => {
              assert.isFalse(await relayer.canRefund(member, currentMonth, amount), 'should not be allowed to spend amount')
            })
          })
        })

        context('when the asking for the next month', () => {
          context('when the requested amount does not exceed the remaining monthly quota', () => {
            const amount = remainingQuota - 1

            it('returns true', async () => {
              assert.isTrue(await relayer.canRefund(member, currentMonth + 1, amount), 'should be allowed to spend amount')
            })
          })

          context('when the requested amount is equal to the remaining monthly quota', () => {
            const amount = remainingQuota

            it('returns true', async () => {
              assert.isTrue(await relayer.canRefund(member, currentMonth + 1, amount), 'should be allowed to spend amount')
            })
          })

          context('when the requested amount is greater than the remaining monthly quota', () => {
            const amount = remainingQuota + 1

            it('returns true', async () => {
              assert.isTrue(await relayer.canRefund(member, currentMonth + 1, amount), 'should be allowed to spend amount')
            })
          })
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.canRefund(member, 0, MONTHLY_REFUND_QUOTA), 'INIT_NOT_INITIALIZED')
      })
    })
  })

  describe('relay', () => {
    context('when the app is initialized', () => {
      let signature, calldata, gasRefund = 50000, nonce = 10

      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      it('can call the app without going through the relayer', async () => {
        await app.write(10, { from: member })
        assert.equal((await app.read()).toString(), 10, 'app value does not match')

        await assertRevert(app.write(10, { from: someone }), 'APP_AUTH_FAILED')
      })

      context('when the sender is an allowed service', () => {
        const from = offChainRelayerService

        beforeEach('allow service', async () => await relayer.allowService(offChainRelayerService, { from: root }))

        context('when the relayed call does not revert', () => {
          context('when the signature valid', () => {
            beforeEach('sign relayed call', () => {
              calldata = app.contract.write.getData(10)
              signature = signRelayedTx({ from: member, to: app.address, nonce, calldata, gasRefund })
            })

            context('when the nonce is not used', () => {
              context('when the sender can refund requested gas amount', () => {
                context('when the relayer has funds', () => {
                  beforeEach('fund relayer', async () => {
                    await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
                  })

                  it('relays transactions to app', async () => {
                    await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })
                    assert.equal((await app.read()).toString(), 10, 'app value does not match')
                  })

                  it('refunds the off-chain service', async () => {
                    const previousRelayerBalance = await web3.eth.getBalance(relayer.address)
                    const previousServiceBalance = await web3.eth.getBalance(offChainRelayerService)

                    const { tx, receipt: { gasUsed } } = await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })
                    const { gasPrice: gasPriceUsed } = await web3.eth.getTransaction(tx)

                    const txRefund = gasRefund * GAS_PRICE
                    const realTxCost = gasPriceUsed.mul(gasUsed)

                    const currentRelayerBalance = await web3.eth.getBalance(relayer.address)
                    const currentServiceBalance = await web3.eth.getBalance(offChainRelayerService)

                    assert.equal(currentRelayerBalance.toString(), previousRelayerBalance.minus(txRefund).toString())
                    assert.equal(currentServiceBalance.toString(), previousServiceBalance.minus(realTxCost).plus(txRefund).toString())
                  })

                  it('updates the last nonce used of the sender', async () => {
                    await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })

                    assert.equal((await relayer.getLastUsedNonce(member)).toString(), nonce, 'last nonce should match')
                    assert.isFalse(await relayer.canUseNonce(member, nonce), 'last nonce should have been updated')
                    assert.isTrue(await relayer.canUseNonce(member, nonce + 1), 'next nonce should not be used')
                  })

                  it('updates the monthly refunds of the sender', async () => {
                    const currentMonth = await relayer.getCurrentMonth()
                    const previousMonthlyRefunds = await relayer.getMonthlyRefunds(member, currentMonth)
                    await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })

                    const txRefund = gasRefund * GAS_PRICE
                    const currentMonthlyRefunds = await relayer.getMonthlyRefunds(member, currentMonth)
                    assert.equal(previousMonthlyRefunds.toString(), currentMonthlyRefunds.minus(txRefund).toString(), 'total refunds should have been updated')
                  })

                  it('emits an event', async () => {
                    const receipt = await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })

                    assertAmountOfEvents(receipt, 'TransactionRelayed')
                    assertEvent(receipt, 'TransactionRelayed', { from: member, to: app.address, nonce, data: calldata })
                  })

                  it('overloads the first relayed transaction with ~80k and the followings with ~50k of gas', skipCoverage(async () => {
                    const { receipt: { cumulativeGasUsed: nonRelayerGasUsed } } = await app.write(10, { from: member })

                    const { receipt: { cumulativeGasUsed: firstRelayedGasUsed } } = await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })

                    const secondSignature = signRelayedTx({ from: member, to: app.address, nonce: nonce + 1, calldata, gasRefund })
                    const { receipt: { cumulativeGasUsed: secondRelayedGasUsed } } = await relayer.relay(member, app.address, nonce + 1, calldata, gasRefund, GAS_PRICE, secondSignature, { from })

                    const firstGasOverload = firstRelayedGasUsed - nonRelayerGasUsed
                    const secondGasOverload = secondRelayedGasUsed - nonRelayerGasUsed

                    console.log('firstGasOverload:', firstGasOverload)
                    console.log('secondGasOverload:', secondGasOverload)

                    assert.isBelow(firstGasOverload, 80000, 'first relayed txs gas overload is higher than 80k')
                    assert.isBelow(secondGasOverload, 50000, 'following relayed txs gas overload is higher than 50k')
                  }))
                })

                context('when the relayer does not have funds', () => {
                  it('reverts', async () => {
                    await assertRevert(relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_GAS_REFUND_FAIL')
                  })
                })
              })

              context('when the sender has reached his monthly gas allowed quota', () => {
                beforeEach('reduce allowed gas quota', async () => {
                  await relayer.setMonthlyRefundQuota(gasRefund * GAS_PRICE - 1, { from: root })
                })

                it('reverts', async () => {
                  await assertRevert(relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_GAS_QUOTA_EXCEEDED')
                })
              })
            })

            context('when the nonce is already used', () => {
              beforeEach('relay tx', async () => {
                await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: 1e18, gas: SEND_ETH_GAS })
                await relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from })
              })

              it('reverts', async () => {
                await assertRevert(relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_NONCE_ALREADY_USED')
              })
            })
          })

          context('when the signature is not valid', () => {
            it('reverts', async () => {
              const signature = web3.eth.sign(member, 'bla')

              await assertRevert(relayer.relay(member, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_INVALID_SENDER_SIGNATURE')
            })
          })
        })

        context('when the relayed call reverts', () => {
          context('when the signature is not valid', () => {
            it('forwards the revert reason', async () => {
              calldata = app.contract.write.getData(10)
              signature = signRelayedTx({ from: someone, to: app.address, calldata, nonce, gasRefund })

              await assertRevert(relayer.relay(someone, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'APP_AUTH_FAILED')
            })
          })

          context('when the signature is not valid', () => {
            it('reverts', async () => {
              const signature = web3.eth.sign(someone, 'bla')

              await assertRevert(relayer.relay(someone, app.address, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_INVALID_SENDER_SIGNATURE')
            })
          })
        })
      })

      context('when the sender is not an allowed service', () => {
        const from = someone

        it('reverts', async () => {
          await assertRevert(relayer.relay(member, someone, nonce, calldata, gasRefund, GAS_PRICE, signature, { from }), 'RELAYER_SERVICE_NOT_ALLOWED')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.relay(member, someone, 1, '0x', 10, GAS_PRICE, '0x'), 'RELAYER_SERVICE_NOT_ALLOWED')
      })
    })
  })

  describe('allowService', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the sender is allowed', () => {
        const from = root

        it('adds a new allowed service', async () => {
          await relayer.allowService(someone, {from})

          assert(await relayer.isServiceAllowed(someone), 'service should be allowed')
        })

        it('emits an event', async () => {
          const receipt = await relayer.allowService(someone, {from})

          assertAmountOfEvents(receipt, 'ServiceAllowed')
          assertEvent(receipt, 'ServiceAllowed', {service: someone})
        })
      })

      context('when the sender is not allowed', () => {
        const from = someone

        it('reverts', async () => {
          await assertRevert(relayer.allowService(someone, {from}), 'APP_AUTH_FAILED')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.allowService(offChainRelayerService, { from: root }), 'APP_AUTH_FAILED')
      })
    })
  })

  describe('disallowService', () => {
    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the sender is allowed', () => {
        const from = root

        it('adds a new allowed service', async () => {
          await relayer.disallowService(someone, { from })

          assert.isFalse(await relayer.isServiceAllowed(someone), 'service should not be allowed')
        })

        it('emits an event', async () => {
          const receipt = await relayer.disallowService(someone, { from })

          assertAmountOfEvents(receipt, 'ServiceDisallowed')
          assertEvent(receipt, 'ServiceDisallowed', { service: someone })
        })
      })

      context('when the sender is not allowed', () => {
        const from = someone

        it('reverts', async () => {
          await assertRevert(relayer.disallowService(someone, { from }), 'APP_AUTH_FAILED')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.disallowService(offChainRelayerService, { from: root }), 'APP_AUTH_FAILED')
      })
    })
  })

  describe('setMonthlyRefundQuota', () => {
    const newQuota = 1000

    context('when the app is initialized', () => {
      beforeEach('initialize relayer app', async () => await relayer.initialize(MONTHLY_REFUND_QUOTA))

      context('when the sender is allowed', () => {
        const from = root

        it('changes the monthly refunds quota', async () => {
          await relayer.setMonthlyRefundQuota(newQuota, { from })

          assert.equal((await relayer.getMonthlyRefundQuota()).toString(), newQuota, 'monthly refunds quota does not match')
        })

        it('emits an event', async () => {
          const receipt = await relayer.setMonthlyRefundQuota(newQuota, { from })

          assertAmountOfEvents(receipt, 'MonthlyRefundQuotaSet')
          assertEvent(receipt, 'MonthlyRefundQuotaSet', { who: from, previousQuota: MONTHLY_REFUND_QUOTA, newQuota })
        })
      })

      context('when the sender is not allowed', () => {
        const from = someone

        it('reverts', async () => {
          await assertRevert(relayer.setMonthlyRefundQuota(newQuota, { from }), 'APP_AUTH_FAILED')
        })
      })
    })

    context('when the app is not initialized', () => {
      it('reverts', async () => {
        await assertRevert(relayer.setMonthlyRefundQuota(newQuota, { from: root }), 'APP_AUTH_FAILED')
      })
    })
  })
})
