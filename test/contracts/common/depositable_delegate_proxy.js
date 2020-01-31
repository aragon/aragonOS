const { toChecksumAddress } = require('web3-utils')
const { assertAmountOfEvents, assertEvent } = require('../../helpers/assertEvent')(web3)
const { skipCoverage } = require('../../helpers/coverage')
const { decodeEventsOfType } = require('../../helpers/decodeEvent')
const { assertRevert, assertOutOfGas } = require('../../helpers/assertThrow')
const { getBalance } = require('../../helpers/web3')

// Mocks
const DepositableDelegateProxyMock = artifacts.require('DepositableDelegateProxyMock')
const EthSender = artifacts.require('EthSender')
const ProxyTargetWithoutFallback = artifacts.require('ProxyTargetWithoutFallback')
const ProxyTargetWithFallback = artifacts.require('ProxyTargetWithFallback')

const TX_BASE_GAS = 21000
const SEND_ETH_GAS = TX_BASE_GAS + 9999 // <10k gas is the threshold for depositing
const PROXY_FORWARD_GAS = TX_BASE_GAS + 2e6 // high gas amount to ensure that the proxy forwards the call
const FALLBACK_SETUP_GAS = process.env.SOLIDITY_COVERAGE ? 5000 : 100 // rough estimation of how much gas it spends before executing the fallback code
const SOLIDITY_TRANSFER_GAS = 2300

contract('DepositableDelegateProxy', ([ sender ]) => {
  let ethSender, proxy, target, proxyTargetWithoutFallbackBase, proxyTargetWithFallbackBase

  // Initial setup
  before(async () => {
    ethSender = await EthSender.new()
    proxyTargetWithoutFallbackBase = await ProxyTargetWithoutFallback.new()
    proxyTargetWithFallbackBase = await ProxyTargetWithFallback.new()
  })

  beforeEach(async () => {
    proxy = await DepositableDelegateProxyMock.new()
    target = ProxyTargetWithFallback.at(proxy.address)
  })

  const itForwardsToImplementationIfGasIsOverThreshold = () => {
    context('when implementation address is set', () => {
      const itSuccessfullyForwardsCall = () => {
        it('forwards call with data', async () => {
          const receipt = await target.ping({ gas: PROXY_FORWARD_GAS })
          assertAmountOfEvents(receipt, 'Pong')
        })
      }

      context('when implementation has a fallback', () => {
        beforeEach(async () => {
          await proxy.setImplementationOnMock(proxyTargetWithFallbackBase.address)
        })

        itSuccessfullyForwardsCall()

        it('can receive ETH', async () => {
          const receipt = await target.sendTransaction({ value: 1, gas: SEND_ETH_GAS + FALLBACK_SETUP_GAS })
          assertAmountOfEvents(receipt, 'ReceivedEth')
        })
      })

      context('when implementation doesn\'t have a fallback', () => {
        beforeEach(async () => {
          await proxy.setImplementationOnMock(proxyTargetWithoutFallbackBase.address)
        })

        itSuccessfullyForwardsCall()

        it('reverts when sending ETH', async () => {
          await assertRevert(target.sendTransaction({ value: 1, gas: PROXY_FORWARD_GAS }))
        })
      })
    })

    context('when implementation address is not set', () => {
      it('reverts when a function is called', async () => {
        await assertRevert(target.ping({ gas: PROXY_FORWARD_GAS }))
      })

      it('reverts when sending ETH', async () => {
        await assertRevert(target.sendTransaction({ value: 1, gas: PROXY_FORWARD_GAS }))
      })
    })
  }

  const itRevertsOnInvalidDeposits = () => {
    it('reverts when call has data', async () => {
      await proxy.setImplementationOnMock(proxyTargetWithoutFallbackBase.address)

      await assertRevert(target.ping({ gas: SEND_ETH_GAS }))
    })

    it('reverts when call sends 0 value', async () => {
      await assertRevert(proxy.sendTransaction({ value: 0, gas: SEND_ETH_GAS }))
    })
  }

  context('when proxy is set as depositable', () => {
    beforeEach(async () => {
      await proxy.enableDepositsOnMock()
    })

    context('when call gas is below the forwarding threshold', () => {
      const value = 100

      const assertSendEthToProxy = async ({ value, gas, shouldOOG }) => {
        const initialBalance = await getBalance(proxy.address)

        const sendEthAction = () => proxy.sendTransaction({ from: sender, gas, value })

        if (shouldOOG) {
          await assertOutOfGas(sendEthAction())
          assert.equal((await getBalance(proxy.address)).valueOf(), initialBalance, 'Target balance should be the same as before')
        } else {
          const { receipt, logs } = await sendEthAction()

          assert.equal((await getBalance(proxy.address)).valueOf(), initialBalance.plus(value), 'Target balance should be correct')
          assertAmountOfEvents({ logs }, 'ProxyDeposit')
          assertEvent({ logs }, 'ProxyDeposit', { sender, value })

          return receipt
        }
      }

      it('can receive ETH', async () => {
        const { gasUsed } = await assertSendEthToProxy({ value, gas: SEND_ETH_GAS })
      })

      it(
        'cannot receive ETH if sent with a small amount of gas',
        // Our version of solidity-coverage is not on an istanbul context yet
        // TODO: update solidity-coverage
        skipCoverage(async () => {
          const oogDecrease = 250
          // deposit cannot be done with this amount of gas
          const gas = TX_BASE_GAS + SOLIDITY_TRANSFER_GAS - oogDecrease
          await assertSendEthToProxy({ shouldOOG: true, value, gas })
        })
      )

      it('can receive ETH from contract', async () => {
        const { tx } = await ethSender.sendEth(proxy.address, { value })
        const receipt = await web3.eth.getTransactionReceipt(tx)
        const logs = decodeEventsOfType(receipt, DepositableDelegateProxyMock.abi, 'ProxyDeposit')
        assertAmountOfEvents({ logs }, 'ProxyDeposit')
        assertEvent({ logs }, 'ProxyDeposit', { sender: toChecksumAddress(ethSender.address), value })
      })

      itRevertsOnInvalidDeposits()
    })

    context('when call gas is over forwarding threshold', () => {
      itForwardsToImplementationIfGasIsOverThreshold()
    })
  })

  context('when proxy is not set as depositable', () => {
    context('when call gas is below the forwarding threshold', () => {
      it('reverts when depositing ETH', async () => {
        await assertRevert(proxy.sendTransaction({ value: 1, gas: SEND_ETH_GAS }))
      })

      itRevertsOnInvalidDeposits()
    })

    context('when call gas is over forwarding threshold', () => {
      itForwardsToImplementationIfGasIsOverThreshold()
    })
  })
})
