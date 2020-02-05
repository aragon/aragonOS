const { assertRevert } = require('../../helpers/assertThrow')
const { skipCoverage } = require('../../helpers/coverage')
const { paramForOracle } = require('../../helpers/permissionParams')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AcceptOracle = artifacts.require('AcceptOracle')
const OverGasLimitOracle = artifacts.require('OverGasLimitOracle')
const StateModifyingOracle = artifacts.require('StateModifyingOracle')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'
const MAX_GAS_AVAILABLE = 6900000
const EXPECTED_GAS_USAGE = MAX_GAS_AVAILABLE * 63 / 64

contract('ACL params', ([permissionsRoot, mockAppAddress]) => {
  let aclBase, kernelBase, acl, kernel
  const MOCK_APP_ROLE = "0xAB"

  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
  })

  beforeEach(async () => {
    kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
    await kernel.initialize(aclBase.address, permissionsRoot)
    acl = ACL.at(await kernel.acl())
    await acl.createPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, permissionsRoot)
  })

  context('> ACL Oracle', () => {
    describe('when the oracle accepts', () => {
      let acceptOracle, param

      before(async () => {
        acceptOracle = await AcceptOracle.new()
        param = paramForOracle(acceptOracle.address)
      })

      describe('when permission is set for ANY_ADDR', () => {
        it('ACL allows actions', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
          assert.isTrue(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE))
        })

        it('ACL allows actions with low gas', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
          assert.isTrue(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: 100000 }))
        })
      })

      describe('when permission is set for specific address', async () => {
        it('ACL allows actions when permisison is set for a specific address', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
          assert.isTrue(await acl.hasPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE))
        })
      })
    })

    describe('when the oracle modifies state', () => {
      let stateModifyingOracle, param

      before(async () => {
        stateModifyingOracle = await StateModifyingOracle.new()
        param = paramForOracle(stateModifyingOracle.address)
      })

      describe('when permission is set for ANY_ADDR', () => {
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])

          const hasPermissionTxHash = await acl.hasPermission.sendTransaction(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE })
          const hasPermissionGasConsumed = web3.eth.getTransactionReceipt(hasPermissionTxHash).gasUsed
          assert.closeTo(hasPermissionGasConsumed, EXPECTED_GAS_USAGE, 1000)
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE }))
        })
      })

      describe('when permission is set for specific address', async () => {
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])

          const hasPermissionTxHash = await acl.hasPermission.sendTransaction(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE })
          const hasPermissionGasConsumed = web3.eth.getTransactionReceipt(hasPermissionTxHash).gasUsed
          assert.closeTo(hasPermissionGasConsumed, EXPECTED_GAS_USAGE, 1000)
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE }))
        })
      })
    })

    describe('when the oracle uses all available gas', skipCoverage(() => {
      let overGasLimitOracle, param

      before(async () => {
        overGasLimitOracle = await OverGasLimitOracle.new()
        param = paramForOracle(overGasLimitOracle.address)
      })

      describe('when permission is set for ANY_ADDR', () => {
        // Note `evalParams()` is called twice when calling `hasPermission` for `ANY_ADDR`
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])

          const hasPermissionTxHash = await acl.hasPermission.sendTransaction(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE })
          const hasPermissionGasConsumed = web3.eth.getTransactionReceipt(hasPermissionTxHash).gasUsed
          assert.closeTo(hasPermissionGasConsumed, EXPECTED_GAS_USAGE, 1000)
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE}))
        })

        it('ACL disallows actions with medium gas', async () => {
          const gasAvailable = 3000000
          const expectedGasUsage = gasAvailable * 63 / 64
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])

          const hasPermissionTxHash = await acl.hasPermission.sendTransaction(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: gasAvailable })
          const hasPermissionGasConsumed = web3.eth.getTransactionReceipt(hasPermissionTxHash).gasUsed
          assert.closeTo(hasPermissionGasConsumed, expectedGasUsage, 1000)
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: gasAvailable }))
        })

        it('ACL fails with low gas', async () => {
          // Note gas amount is high due to `evalParams()`, and therefore the Oracle `canPerform()`, function being called twice.
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
          await assertRevert(acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, { gas: 2900000 }))
        })
      })

      describe('when permission is set for specific address', async () => {
        // Note `evalParams()` is only called once when calling `hasPermission` for a specific address
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, [param])

          const hasPermissionTxHash = await acl.hasPermission.sendTransaction(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, { gas: MAX_GAS_AVAILABLE })
          const hasPermissionGasConsumed = web3.eth.getTransactionReceipt(hasPermissionTxHash).gasUsed
          assert.closeTo(hasPermissionGasConsumed, EXPECTED_GAS_USAGE, 105000)
          assert.isFalse(await acl.hasPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE), { gas: MAX_GAS_AVAILABLE })
        })

        it('ACL disallows actions with low gas', async () => {
          const gasAvailable = 190000
          const expectedGasUsage = gasAvailable * 63 / 64
          await acl.grantPermissionP(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, [param])

          const hasPermissionTxHash = await acl.hasPermission.sendTransaction(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, { gas: gasAvailable})
          const hasPermissionGasConsumed = web3.eth.getTransactionReceipt(hasPermissionTxHash).gasUsed
          assert.closeTo(hasPermissionGasConsumed, expectedGasUsage, 10000)
          assert.isFalse(await acl.hasPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, { gas: gasAvailable}))
        })

        it('ACL fails with low gas', async () => {
          await acl.grantPermissionP(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, [param])
          await assertRevert(acl.hasPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, { gas: 180000}))
        })
      })
    }))
  })
})
