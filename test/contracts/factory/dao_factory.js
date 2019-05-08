const DAOFactory = artifacts.require('DAOFactory')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const EVMScriptRegistryConstants = artifacts.require('EVMScriptRegistryConstantsMock')

const ZERO_ADDRES = '0x0000000000000000000000000000000000000000'

const getEventArgument = (receipt, event, arg) => receipt.logs.filter(l => l.event === event)[0].args[arg]

contract('DAO Factory', ([_, root]) => {
  let daoFactory, dao, acl, receipt

  let CORE_NAMESPACE, APP_ADDR_NAMESPACE, APP_BASES_NAMESPACE
  let APP_MANAGER_ROLE, CREATE_PERMISSIONS_ROLE, REGISTRY_ADD_EXECUTOR_ROLE
  let ACL_APP_ID, KERNEL_APP_ID, EVM_SCRIPT_REGISTRY_APP_ID
  let kernelBase, aclBase, scriptsRegistryFactory, scriptsRegistryBase, scriptsRegistryConstants

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    scriptsRegistryFactory = await EVMScriptRegistryFactory.new()
    scriptsRegistryConstants = await EVMScriptRegistryConstants.new()
    scriptsRegistryBase = EVMScriptRegistry.at(await scriptsRegistryFactory.baseReg())
  })

  before('load roles and constants', async () => {
    ACL_APP_ID = await kernelBase.DEFAULT_ACL_APP_ID()
    KERNEL_APP_ID = await kernelBase.KERNEL_APP_ID()
    EVM_SCRIPT_REGISTRY_APP_ID = await scriptsRegistryConstants.getEVMScriptRegistryAppId()

    CORE_NAMESPACE = await kernelBase.CORE_NAMESPACE()
    APP_ADDR_NAMESPACE = await kernelBase.APP_ADDR_NAMESPACE()
    APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()

    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    CREATE_PERMISSIONS_ROLE = await aclBase.CREATE_PERMISSIONS_ROLE()
    REGISTRY_ADD_EXECUTOR_ROLE = await scriptsRegistryBase.REGISTRY_ADD_EXECUTOR_ROLE()
  })

  const itCreatesADao = () => {
    it('creates a new DAO', async () => {
      assert(await dao.hasInitialized(), 'DAO should be initialized')
      assert.equal(await dao.getApp(CORE_NAMESPACE, KERNEL_APP_ID), kernelBase.address)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, ACL_APP_ID), aclBase.address)
      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, ACL_APP_ID), acl.address)
    })

    it('sets the given root address as the permissions creator of the DAO', async () => {
      assert(await acl.hasInitialized(), 'ACL should be initialized')
      assert.equal(await acl.getPermissionManager(acl.address, CREATE_PERMISSIONS_ROLE), root)
      assert.isTrue(await acl.hasPermission(root, acl.address, CREATE_PERMISSIONS_ROLE))
      assert.isFalse(await acl.hasPermission(daoFactory.address, acl.address, CREATE_PERMISSIONS_ROLE))
    })

    it('does not create or grant app manager to the root address of the DAO', async () => {
      assert.equal(await acl.getPermissionManager(dao.address, APP_MANAGER_ROLE), ZERO_ADDRES)
      assert.isFalse(await acl.hasPermission(root, dao.address, APP_MANAGER_ROLE))
      assert.isFalse(await acl.hasPermission(daoFactory.address, dao.address, APP_MANAGER_ROLE))
    })
  }

  const itDoesCreateAnEVMScriptsRegistry = () => {
    it('deploys an EVM script registry with a script executor', async () => {
      const scriptsRegistry = EVMScriptRegistry.at(getEventArgument(receipt, 'DeployEVMScriptRegistry', 'reg'))

      assert(await scriptsRegistry.hasInitialized(), 'EVM scripts registry should be initialized')
      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), scriptsRegistry.address)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), scriptsRegistryBase.address)

      const [executor] = await scriptsRegistry.executors(1)
      assert.equal(executor, await scriptsRegistryFactory.baseCallScript())

      assert.equal(await acl.getPermissionManager(scriptsRegistry.address, REGISTRY_ADD_EXECUTOR_ROLE), ZERO_ADDRES)
      assert.isFalse(await acl.hasPermission(root, scriptsRegistry.address, REGISTRY_ADD_EXECUTOR_ROLE))
      assert.isFalse(await acl.hasPermission(scriptsRegistryFactory.address, scriptsRegistry.address, REGISTRY_ADD_EXECUTOR_ROLE))
    })
  }

  const itDoesNotCreateAnEVMScriptsRegistry = () => {
    it('does not deploy an EVM script registry with a script executor', async () => {
      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), ZERO_ADDRES)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), ZERO_ADDRES)
    })
  }

  describe('newDAO', () => {
    context('when it was created with an EVM scripts registry factory', () => {
      before('create factory with an EVM scripts registry factory', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, scriptsRegistryFactory.address)
      })

      before('create a DAO', async () => {
        receipt = await daoFactory.newDAO(root)
        dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
      })

      itCreatesADao()
      itDoesCreateAnEVMScriptsRegistry()
    })

    context('when it was created without an EVM scripts registry factory', () => {
      before('create factory without an EVM scripts registry factory', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDRES)
      })

      before('create a DAO', async () => {
        receipt = await daoFactory.newDAO(root)
        dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
      })

      itCreatesADao()
      itDoesNotCreateAnEVMScriptsRegistry()
    })
  })
})
