const { toChecksumAddress } = require('web3-utils')
const { assertAmountOfEvents, assertEvent } = require('../../helpers/assertEvent')(web3)
const { decodeEventsOfType } = require('../../helpers/decodeEvent')
const { assertRevert, assertOutOfGas } = require('../../helpers/assertThrow')
const { getBalance } = require('../../helpers/web3')

// Mocks
const DepositableDelegateProxyMock = artifacts.require('DepositableDelegateProxyMock')
const EthSender = artifacts.require('EthSender')
const ProxyTarget = artifacts.require('ProxyTarget')
const ProxyTargetWithFallback = artifacts.require('ProxyTargetWithFallback')

const TX_BASE_GAS = 21000
const SEND_ETH_GAS = TX_BASE_GAS + 9999 // 10k gas is the threshold for depositing
const FALLBACK_SETUP_GAS = 100 // rough estimation of how much gas it spends before executing the fallback code
const SOLIDITY_TRANSFER_GAS = 2300
const ISTANBUL_SLOAD_GAS_INCREASE = 600

contract('DepositableDelegateProxy', ([ sender ]) => {
  let ethSender, proxy, proxyTargetBase, proxyTargetWithFallbackBase

  // Initial setup
  before(async () => {
    ethSender = await EthSender.new()
    proxyTargetBase = await ProxyTarget.new()
    proxyTargetWithFallbackBase = await ProxyTargetWithFallback.new()
  })

  beforeEach(async () => {
    proxy = await DepositableDelegateProxyMock.new()
  })

  const itForwardsToImplementationIfGasIsOverThreshold = () => {
    let target
    
    beforeEach(() => {
      target = ProxyTargetWithFallback.at(proxy.address)
    })

    context('when implementation address is set', () => {
      const itSuccessfullyForwardsCall = () => {
        it('forwards call with data', async () => {
          const receipt = await target.ping()
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
          await proxy.setImplementationOnMock(proxyTargetBase.address)
        })

        itSuccessfullyForwardsCall()

        it('reverts when sending ETH', async () => {
          await assertRevert(target.sendTransaction({ value: 1 }))
        })
      })
    })

    context('when implementation address is not set', () => {
      it('reverts when a function is called', async () => {
        await assertRevert(target.ping())
      })

      it('reverts when sending ETH', async () => {
        await assertRevert(target.sendTransaction({ value: 1 }))
      })
    })
  }

  const itRevertsOnInvalidDeposits = () => {
    it('reverts when call has data', async () => {
      await assertRevert(proxy.sendTransaction({ value: 1, data: '0x01', gas: SEND_ETH_GAS }))
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

      const sendEthToProxy = async ({ value, gas, shouldOOG }) => {
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

      it('can receive ETH (Constantinople)', async () => {
        const { gasUsed } = await sendEthToProxy({ value, gas: SEND_ETH_GAS })
        console.log('Used gas:', gasUsed - TX_BASE_GAS)
      })

      // TODO: Remove when the targetted EVM has been upgraded to Istanbul (EIP-1884)
      it('can receive ETH (Istanbul, EIP-1884)', async () => {
        const gas = TX_BASE_GAS + SOLIDITY_TRANSFER_GAS - ISTANBUL_SLOAD_GAS_INCREASE
        const { gasUsed } = await sendEthToProxy({ value, gas })
        const gasUsedIstanbul = gasUsed - TX_BASE_GAS + ISTANBUL_SLOAD_GAS_INCREASE
        console.log('Used gas (Istanbul):', gasUsedIstanbul)

        assert.isBelow(gasUsedIstanbul, 2300, 'Gas cost under Istanbul cannot be above 2300 gas')
      })

      // TODO: Remove when the targetted EVM has been upgraded to Istanbul (EIP-1884)
      it('cannot receive ETH if sent with a small amount of gas', async () => {
        // deposit cannot be done with this amount of gas
        const gas = TX_BASE_GAS + SOLIDITY_TRANSFER_GAS - ISTANBUL_SLOAD_GAS_INCREASE - 250
        await sendEthToProxy({ shouldOOG: true, value, gas })
      })

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