const { getEventArgument } = require('@aragon/contract-helpers-test')
const { getInstalledApp } = require('@aragon/contract-helpers-test/src/aragon-os')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

const AragonAppMock = artifacts.require('AragonAppMock')
const ERC165Mock = artifacts.require('ERC165Mock')

const ARAGON_APP_INTERFACE = '0x54053e6c'
const ERC165_INTERFACE = '0x01ffc9a7'

contract('AragonApp', ([_, owner]) => {
  let aragonApp

  before('deploy AragonAppMock', async () => {
    aragonApp = await AragonAppMock.new()
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      const erc165 = await ERC165Mock.new()
      assert.isTrue(await aragonApp.supportsInterface(ERC165_INTERFACE), 'does not support ERC165')

      assert.equal(await erc165.interfaceID(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
      assert.equal(await erc165.ERC165_INTERFACE(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
    })

    it('supports AragonApp interface', async () => {
      assert.isTrue(await aragonApp.supportsInterface(ARAGON_APP_INTERFACE), 'does not support AragonApp interface')

      assert.equal(await aragonApp.interfaceID(), ARAGON_APP_INTERFACE, 'AragonApp interface ID does not match')
      assert.equal(await aragonApp.ARAGON_APP_INTERFACE(), ARAGON_APP_INTERFACE, 'AragonApp interface ID does not match')
    })

    it('does not support 0xffffffff', async () => {
      assert.isFalse(await aragonApp.supportsInterface('0xffffffff'), 'should not support 0xffffffff')
    })
  })
})
