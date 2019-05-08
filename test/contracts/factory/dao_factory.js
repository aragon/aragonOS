const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument } = require('../../helpers/events')

const DAOFactory = artifacts.require('DAOFactory')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KillSwitch = artifacts.require('KillSwitch')
const IssuesRegistry = artifacts.require('IssuesRegistry')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const EVMScriptRegistryConstants = artifacts.require('EVMScriptRegistryConstantsMock')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract('DAO Factory', ([_, root]) => {
  let daoFactory, dao, acl, receipt

  let CORE_NAMESPACE, APP_ADDR_NAMESPACE, APP_BASES_NAMESPACE
  let APP_MANAGER_ROLE, CREATE_PERMISSIONS_ROLE, REGISTRY_ADD_EXECUTOR_ROLE
  let ACL_APP_ID, KERNEL_APP_ID, KILL_SWITCH_APP_ID, EVM_SCRIPT_REGISTRY_APP_ID
  let kernelBase, aclBase, killSwitchBase, issuesRegistry, scriptsRegistryFactory, scriptsRegistryBase, scriptsRegistryConstants

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    killSwitchBase = await KillSwitch.new()
    issuesRegistry = await IssuesRegistry.new()
    scriptsRegistryFactory = await EVMScriptRegistryFactory.new()
    scriptsRegistryConstants = await EVMScriptRegistryConstants.new()
    scriptsRegistryBase = EVMScriptRegistry.at(await scriptsRegistryFactory.baseReg())
  })

  before('load roles and constants', async () => {
    ACL_APP_ID = await kernelBase.DEFAULT_ACL_APP_ID()
    KERNEL_APP_ID = await kernelBase.KERNEL_APP_ID()
    KILL_SWITCH_APP_ID = await kernelBase.DEFAULT_KILL_SWITCH_APP_ID()
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
      assert.equal(await acl.getPermissionManager(dao.address, APP_MANAGER_ROLE), ZERO_ADDR)
      assert.isFalse(await acl.hasPermission(root, dao.address, APP_MANAGER_ROLE))
      assert.isFalse(await acl.hasPermission(daoFactory.address, dao.address, APP_MANAGER_ROLE))
    })
  }

  const itDoesCreateAnEVMScriptsRegistry = () => {
    it('deploys an EVM script registry with a script executor', async () => {
      const scriptsRegistry = EVMScriptRegistry.at(getEventArgument(receipt, 'DeployEVMScriptRegistry', 'registry'))

      assert(await scriptsRegistry.hasInitialized(), 'EVM scripts registry should be initialized')
      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), scriptsRegistry.address)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), scriptsRegistryBase.address)

      const [executor] = await scriptsRegistry.executors(1)
      assert.equal(executor, await scriptsRegistryFactory.baseCallScript())

      assert.equal(await acl.getPermissionManager(scriptsRegistry.address, REGISTRY_ADD_EXECUTOR_ROLE), ZERO_ADDR)
      assert.isFalse(await acl.hasPermission(root, scriptsRegistry.address, REGISTRY_ADD_EXECUTOR_ROLE))
      assert.isFalse(await acl.hasPermission(scriptsRegistryFactory.address, scriptsRegistry.address, REGISTRY_ADD_EXECUTOR_ROLE))
    })
  }

  const itDoesNotCreateAnEVMScriptsRegistry = () => {
    it('does not deploy an EVM script registry with a script executor', async () => {
      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), ZERO_ADDR)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, EVM_SCRIPT_REGISTRY_APP_ID), ZERO_ADDR)
    })
  }

  const itDoesCreateAKillSwitch = () => {
    it('does install a kill switch instance', async () => {
      const killSwitch = KillSwitch.at(await dao.killSwitch())

      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, KILL_SWITCH_APP_ID), killSwitch.address)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, KILL_SWITCH_APP_ID), killSwitchBase.address)
    })
  }

  const itDoesNotCreateAKillSwitch = () => {
    it('does not have a kill switch installed', async () => {
      assert.equal(await dao.killSwitch(), ZERO_ADDR)
      assert.equal(await dao.getApp(APP_ADDR_NAMESPACE, KILL_SWITCH_APP_ID), ZERO_ADDR)
      assert.equal(await dao.getApp(APP_BASES_NAMESPACE, KILL_SWITCH_APP_ID), ZERO_ADDR)
    })
  }

  describe('newDAO', () => {
    context('when it was created with an EVM scripts registry factory', () => {
      before('create factory with an EVM scripts registry factory', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDR, scriptsRegistryFactory.address)
      })

      before('create a DAO', async () => {
        receipt = await daoFactory.newDAO(root)
        dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
      })

      itCreatesADao()
      itDoesCreateAnEVMScriptsRegistry()
      itDoesNotCreateAKillSwitch()
    })

    context('when it was created without an EVM scripts registry factory', () => {
      before('create factory without an EVM scripts registry factory', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDR, ZERO_ADDR)
      })

      before('create a DAO', async () => {
        receipt = await daoFactory.newDAO(root)
        dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
      })

      itCreatesADao()
      itDoesNotCreateAnEVMScriptsRegistry()
      itDoesNotCreateAKillSwitch()
    })
  })

  describe('newDAOWithKillSwitch', () => {
    context('when it was created with a base kill switch', () => {
      context('when it was created with an EVM scripts registry factory', () => {
        before('create factory with an EVM scripts registry factory', async () => {
          daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, scriptsRegistryFactory.address)
        })

        before('create a DAO', async () => {
          receipt = await daoFactory.newDAOWithKillSwitch(root, issuesRegistry.address)
          dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
          acl = ACL.at(await dao.acl())
        })

        itCreatesADao()
        itDoesCreateAnEVMScriptsRegistry()
        itDoesCreateAKillSwitch()
      })

      context('when it was created without an EVM scripts registry factory', () => {
        before('create factory without an EVM scripts registry factory', async () => {
          daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, ZERO_ADDR)
        })

        before('create a DAO', async () => {
          receipt = await daoFactory.newDAOWithKillSwitch(root, issuesRegistry.address)
          dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
          acl = ACL.at(await dao.acl())
        })

        itCreatesADao()
        itDoesNotCreateAnEVMScriptsRegistry()
        itDoesCreateAKillSwitch()
      })
    })

    context('when it was created without a base kill switch', () => {
      context('when it was created with an EVM scripts registry factory', () => {
        before('create factory with an EVM scripts registry factory', async () => {
          daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDR, scriptsRegistryFactory.address)
        })

        it('reverts', async () => {
          await assertRevert(daoFactory.newDAOWithKillSwitch(root, issuesRegistry.address), 'DF_MISSING_BASE_KILL_SWITCH')
        })
      })

      context('when it was created without an EVM scripts registry factory', () => {
        before('create factory without an EVM scripts registry factory', async () => {
          daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDR, ZERO_ADDR)
        })

        it('reverts', async () => {
          await assertRevert(daoFactory.newDAOWithKillSwitch(root, issuesRegistry.address), 'DF_MISSING_BASE_KILL_SWITCH')
        })
      })
    })
  })
})
