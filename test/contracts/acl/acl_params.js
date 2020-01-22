const { assertRevert } = require('../../helpers/assertThrow')
const { paramForOracle } = require('../../helpers/permissionParams')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const OverGasLimitOracle = artifacts.require('OverGasLimitOracle')
const StateModifyingOracle = artifacts.require('StateModifyingOracle')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

contract('ACL', ([permissionsRoot, mockAppAddress]) => {
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

  context('> ACLOracle OverGasLimitOracle', () => {
    let overGasLimitOracle, param

    beforeEach(async () => {
      overGasLimitOracle = await OverGasLimitOracle.new()
      param = paramForOracle(overGasLimitOracle.address)
    })

    // Note `evalParams()` is called twice when calling `hasPermission` for `ANY_ADDR`
    it('fails when oracle canPerform goes OOG', async () => {
      await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
      await assertRevert(acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE), "ACL_ORACLE_OOG")
    })

    // Note `evalParams()` is only called once when calling `hasPermission` for a specific address
    it('fails when oracle canPerform goes OOG with specified permission owner', async () => {
      await acl.grantPermissionP(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, [param])
      await assertRevert(acl.hasPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE), "ACL_ORACLE_OOG")
    })

  })

  context('> ACLOracle StateModifyingOracle', () => {
    let stateModifyingOracle, param

    beforeEach(async () => {
      stateModifyingOracle = await StateModifyingOracle.new()
      param = paramForOracle(stateModifyingOracle.address)
    })

    it('fails when oracle canPerform modifies state', async () => {
      await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])
      await assertRevert(acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE), "ACL_ORACLE_OOG")
    })
  })
})