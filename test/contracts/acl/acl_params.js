const { assertRevert } = require('../../helpers/assertThrow')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const OverGasLimitOracle = artifacts.require('OverGasLimitOracle')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

contract('ACL', ([permissionsRoot, mockAppAddress]) => {
  let aclBase, kernelBase, acl, kernel, overGasLimitOracle
  const MOCK_APP_ROLE = "0xAB"

  before(async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
  })

  beforeEach(async () => {
    kernel = Kernel.at((await KernelProxy.new(kernelBase.address)).address)
    await kernel.initialize(aclBase.address, permissionsRoot)
    acl = ACL.at(await kernel.acl())
    overGasLimitOracle = await OverGasLimitOracle.new()
  })

  context('> ACLOracle Permission', () => {

    it('fails when oracle canPerform goes OOG', async () => {
      // Set role such that the Oracle canPerform() function is used to determine the permission
      const argId = '0xCB' // arg 203 - Oracle ID
      const op = '01'      // equal
      const value = `00000000000000000000${overGasLimitOracle.address.slice(2)}`  // oracle address
      const param = new web3.BigNumber(`${argId}${op}${value}`)

      await acl.createPermission(permissionsRoot, mockAppAddress, MOCK_APP_ROLE, permissionsRoot)
      await acl.grantPermissionP(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE, [param])

      await assertRevert(acl.hasPermission(ANY_ADDR, mockAppAddress, MOCK_APP_ROLE), "ACL_ORACLE_OOG")
    })

  })
})