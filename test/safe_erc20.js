const { assertRevert } = require('./helpers/assertThrow')

// Mocks
const SafeERC20Mock = artifacts.require('SafeERC20Mock')
const TokenMock = artifacts.require('TokenMock')
const TokenReturnFalseMock = artifacts.require('TokenReturnFalseMock')
const TokenReturnMissingMock = artifacts.require('TokenReturnMissingMock')

const assertMockResult = (receipt, result) => {
  const events = receipt.logs.filter(x => x.event == 'Result')
  const eventArg = events[0].args.result
  assert.equal(eventArg, result, `Result not expected (got ${eventArg} instead of ${result})`)
}

contract('SafeERC20', accounts => {
  const [owner, receiver] = accounts
  const initialBalance = 10000
  let safeERC20Mock

  before(async () => {
    safeERC20Mock = await SafeERC20Mock.new()
  })

  const testGroups = [
    {
      title: 'Standards compliant, reverting token',
      tokenContract: TokenMock,
      revertsOnFailure: true,
    },
    {
      title: 'Standards compliant, non-reverting token',
      tokenContract: TokenReturnFalseMock,
      revertsOnFailure: false,
    },
    {
      title: 'Non-standards compliant, missing return token',
      tokenContract: TokenReturnMissingMock,
      revertsOnFailure: true,
    },
  ]

  for ({ title, revertsOnFailure, tokenContract} of testGroups) {
    // Change behaviour based on whether failing action reverts or returns false
    const assertFailingAction = async (action) => {
      if (revertsOnFailure) {
        await assertRevert(action)
      } else {
        const receipt = await action()
        assertMockResult(receipt, false)
      }
    }

    context(`> ${title}`, () => {
      let tokenMock

      beforeEach(async () => {
        tokenMock = await tokenContract.new(owner, initialBalance)
      })

      it('can correctly transfer', async () => {
        // Add balance to the mock
        const transferAmount = 5000
        await tokenMock.transfer(safeERC20Mock.address, transferAmount)

        // Transfer it all back from the mock
        const receipt = await safeERC20Mock.transfer(tokenMock.address, owner, transferAmount)
        assertMockResult(receipt, true)
        assert.equal((await tokenMock.balanceOf(owner)).valueOf(), initialBalance, 'Balance of owner should be correct')
        assert.equal((await tokenMock.balanceOf(safeERC20Mock.address)).valueOf(), 0, 'Balance of mock should be correct')
      })

      it('detects failed transfer', async () => {
        // Attempt transfer when mock has no balance
        await assertFailingAction(
          () => safeERC20Mock.transfer(tokenMock.address, owner, 1000)
        )
        assert.equal((await tokenMock.balanceOf(owner)).valueOf(), initialBalance, 'Balance of owner should stay the same')
        assert.equal((await tokenMock.balanceOf(safeERC20Mock.address)).valueOf(), 0, 'Balance of mock should stay the same')
      })

      it('can correctly approve', async () => {
        const approvedAmount = 5000

        // Create approval from the mock
        const receipt = await safeERC20Mock.approve(tokenMock.address, receiver, approvedAmount)
        assertMockResult(receipt, true)
        assert.equal((await tokenMock.allowance(safeERC20Mock.address, receiver)).valueOf(), approvedAmount, 'Allowance of receiver should be correct')
      })

      it('detects failed approve', async () => {
        const preApprovedAmount = 5000

        // Create pre-exisiting approval
        await safeERC20Mock.approve(tokenMock.address, receiver, preApprovedAmount)

        // Attempt to create another approval without reseting it back to 0
        await assertFailingAction(
          () => safeERC20Mock.approve(tokenMock.address, receiver, preApprovedAmount - 500)
        )
        assert.equal((await tokenMock.allowance(safeERC20Mock.address, receiver)).valueOf(), preApprovedAmount, 'Allowance of receiver should be the pre-existing value')
      })

      it('can correctly transferFrom', async () => {
        // Create approval
        const approvedAmount = 5000
        await tokenMock.approve(safeERC20Mock.address, approvedAmount)

        // Transfer to receiver through the mock
        const receipt = await safeERC20Mock.transferFrom(tokenMock.address, owner, receiver, approvedAmount)
        assertMockResult(receipt, true)
        assert.equal((await tokenMock.balanceOf(owner)).valueOf(), initialBalance - approvedAmount, 'Balance of owner should be correct')
        assert.equal((await tokenMock.balanceOf(receiver)).valueOf(), approvedAmount, 'Balance of receiver should be correct')
        assert.equal((await tokenMock.balanceOf(safeERC20Mock.address)).valueOf(), 0, 'Balance of mock should stay the same')
      })

      it('detects failed transferFrom', async () => {
        // Attempt transfer to receiver through the mock when mock wasn't approved
        await assertFailingAction(
          () => safeERC20Mock.transferFrom(tokenMock.address, owner, receiver, 5000)
        )
        assert.equal((await tokenMock.balanceOf(owner)).valueOf(), initialBalance, 'Balance of owner should stay the same')
        assert.equal((await tokenMock.balanceOf(receiver)).valueOf(), 0, 'Balance of receiver should stay the same')
        assert.equal((await tokenMock.balanceOf(safeERC20Mock.address)).valueOf(), 0, 'Balance of mock should stay the same')
      })
    })
  }
})
