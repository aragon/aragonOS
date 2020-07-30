const { getEventArgument, getNewProxyAddress } = require('@aragon/contract-helpers-test')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const AragonApp = artifacts.require('AragonAppMock')
const ERC165 = artifacts.require('ERC165Mock')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('AragonApp', ([_, owner, agreement, anotherAgreement, someone]) => {
  let aragonApp

  const ARAGON_APP_INTERFACE = '0x54053e6c'
  const ERC165_INTERFACE = '0x01ffc9a7'

  before('deploy DAO and install aragon app', async () => {
    const kernelBase = await Kernel.new(true)
    const aclBase = await ACL.new()
    const registryFactory = await EVMScriptRegistryFactory.new()
    const daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, registryFactory.address)

    const receiptDao = await daoFact.newDAO(owner)
    dao = await Kernel.at(getEventArgument(receiptDao, 'DeployDAO', 'dao'))
    acl = await ACL.at(await dao.acl())
    const aragonAppBase = await AragonApp.new()

    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(owner, dao.address, APP_MANAGER_ROLE, owner, { from: owner })
    const initializeData = aragonAppBase.contract.initialize.getData()
    const receiptInstance = await dao.newAppInstance('0x1234', aragonAppBase.address, initializeData, false, { from: owner })
    aragonApp = await AragonApp.at(getNewProxyAddress(receiptInstance))
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      const erc165 = await ERC165.new()
      assert.isTrue(await aragonApp.supportsInterface(ERC165_INTERFACE), 'does not support ERC165')

      assert.equal(await erc165.interfaceID(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
      assert.equal(await erc165.ERC165_INTERFACE(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
    })

    it('supports Aragon App interface', async () => {
      const aragonApp = await AragonApp.new()
      assert.isTrue(await aragonApp.supportsInterface(ARAGON_APP_INTERFACE), 'does not support Aragon App interface')

      assert.equal(await aragonApp.interfaceID(), ARAGON_APP_INTERFACE, 'Aragon App interface ID does not match')
      assert.equal(await aragonApp.ARAGON_APP_INTERFACE(), ARAGON_APP_INTERFACE, 'Aragon App interface ID does not match')
    })

    it('does not support 0xffffffff', async () => {
      assert.isFalse(await aragonApp.supportsInterface('0xffffffff'), 'should not support 0xffffffff')
    })
  })
})
