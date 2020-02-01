const { assertRevert } = require('../../helpers/assertThrow')
const { paramForOracle } = require('../../helpers/permissionParams')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const AcceptOracle = artifacts.require('AcceptOracle')
const OverGasLimitOracle = artifacts.require('OverGasLimitOracle')
const StateModifyingOracle = artifacts.require('StateModifyingOracle')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

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
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE))
        })
      })

      describe('when permission is set for specific address', async () => {
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE))
        })
      })
    })

    describe('when the oracle uses all available gas', () => {
      let overGasLimitOracle, param

      before(async () => {
        overGasLimitOracle = await OverGasLimitOracle.new()
        param = paramForOracle(overGasLimitOracle.address)
      })

      describe('when permission is set for ANY_ADDR', () => {
        // Note `evalParams()` is called twice when calling `hasPermission` for `ANY_ADDR`
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
          assert.isFalse(await acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE))
        })
      })

      describe('when permission is set for specific address', async () => {
        // Note `evalParams()` is only called once when calling `hasPermission` for a specific address
        it('ACL disallows actions', async () => {
          await acl.grantPermissionP(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, [param])
          assert.isFalse(await acl.hasPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE))
        })
      })
    })
  })
})
