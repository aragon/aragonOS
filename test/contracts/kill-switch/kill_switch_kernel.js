const { SEVERITY } = require('./enums')
const { assertRevert } = require('../../helpers/assertThrow')
const { getNewProxyAddress, getEventArgument } = require('../../helpers/events')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const KillSwitch = artifacts.require('KillSwitch')
const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('KillSwitchedAppMock')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

const RevertingKillSwitchMock = artifacts.require('RevertingKillSwitchMock')
const KernelWithoutKillSwitchMock = artifacts.require('KernelWithoutKillSwitchMock')
const KernelWithNonCompliantKillSwitchMock = artifacts.require('KernelWithNonCompliantKillSwitchMock')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SAMPLE_APP_ID = '0x1236000000000000000000000000000000000000000000000000000000000000'

contract('KillSwitch Kernel', ([_, root, owner, securityPartner]) => {
  let dao, acl, app, registryFactory
  let kernelBase, aclBase, appBase, killSwitchBase, issuesRegistryBase, daoFactory
  let kernelWithoutKillSwitchBase, kernelWithNonCompliantKillSwitchBase, failingKillSwitchBase
  let CORE_NAMESPACE, KERNEL_APP_ID, APP_MANAGER_ROLE, CHANGE_SEVERITY_ROLE, CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE, CHANGE_ISSUES_REGISTRY_ROLE, CHANGE_WHITELISTED_INSTANCES_ROLE, CHANGE_BLACKLISTED_BASE_IMPLS_ROLE, CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE, WRITER_ROLE

  before('deploy base implementations', async () => {
    // real
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    registryFactory = await EVMScriptRegistryFactory.new()
    killSwitchBase = await KillSwitch.new()
    issuesRegistryBase = await IssuesRegistry.new()

    // mocks
    appBase = await KillSwitchedApp.new()
    failingKillSwitchBase = await RevertingKillSwitchMock.new()
    kernelWithoutKillSwitchBase = await KernelWithoutKillSwitchMock.new()
    kernelWithNonCompliantKillSwitchBase = await KernelWithNonCompliantKillSwitchMock.new()
  })

  before('load constants and roles', async () => {
    WRITER_ROLE = await appBase.WRITER_ROLE()
    CORE_NAMESPACE = await kernelBase.CORE_NAMESPACE()
    KERNEL_APP_ID = await kernelBase.KERNEL_APP_ID()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    CHANGE_SEVERITY_ROLE = await issuesRegistryBase.CHANGE_SEVERITY_ROLE()
    CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE = await killSwitchBase.CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE()
    CHANGE_ISSUES_REGISTRY_ROLE = await killSwitchBase.CHANGE_ISSUES_REGISTRY_ROLE()
    CHANGE_WHITELISTED_INSTANCES_ROLE = await killSwitchBase.CHANGE_WHITELISTED_INSTANCES_ROLE()
    CHANGE_BLACKLISTED_BASE_IMPLS_ROLE = await killSwitchBase.CHANGE_BLACKLISTED_BASE_IMPLS_ROLE()
    CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE = await killSwitchBase.CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE()
  })

  context('when the kernel version does not support kill-switch logic', async () => {
    before('create DAO factory', async () => {
      daoFactory = await DAOFactory.new(kernelWithoutKillSwitchBase.address, aclBase.address, ZERO_ADDRESS, registryFactory.address)
    })

    beforeEach('deploy DAO without a kill switch and create kill-switched sample app', async () => {
      const daoFactoryReceipt = await daoFactory.newDAO(root)
      dao = Kernel.at(getEventArgument(daoFactoryReceipt, 'DeployDAO', 'dao'))
      acl = ACL.at(await dao.acl())
      await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

      const initializeData = appBase.contract.initialize.getData(owner)
      const appReceipt = await dao.newAppInstance(SAMPLE_APP_ID, appBase.address, initializeData, false, { from: root })
      app = KillSwitchedApp.at(getNewProxyAddress(appReceipt))
      await acl.createPermission(owner, app.address, WRITER_ROLE, root, { from: root })
    })

    it('executes the call', async () => {
      await app.write(10, { from: owner })
      assert.equal(await app.read(), 10)
    })
  })

  context('when the kernel version does support kill-switch logic', async () => {
    context('when the kernel was not initialized with a kill-switch', async () => {
      before('create DAO factory using a kernel that supports kill-switch logic', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, registryFactory.address)
      })

      before('deploy DAO without a kill switch and create kill-switched sample app', async () => {
        const daoFactoryReceipt = await daoFactory.newDAO(root)
        dao = Kernel.at(getEventArgument(daoFactoryReceipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

        const initializeData = appBase.contract.initialize.getData(owner)
        const appReceipt = await dao.newAppInstance(SAMPLE_APP_ID, appBase.address, initializeData, false, { from: root })
        app = KillSwitchedApp.at(getNewProxyAddress(appReceipt))
        await acl.createPermission(owner, app.address, WRITER_ROLE, root, { from: root })
      })

      context('when the function being called is not tagged', () => {
        it('executes the call', async () => {
          assert.equal(await app.read(), 42)
        })
      })

      context('when the function being called is tagged', () => {
        it('executes the call', async () => {
          await app.write(10, { from: owner })
          assert.equal(await app.read(), 10)
        })
      })
    })

    context('when the kernel is initialized with a non-compliant kill-switch implementation', async () => {
      before('create DAO factory', async () => {
        daoFactory = await DAOFactory.new(kernelWithoutKillSwitchBase.address, aclBase.address, killSwitchBase.address, registryFactory.address)
      })

      before('deploy DAO with a kill switch and create kill-switched sample app', async () => {
        const daoFactoryReceipt = await daoFactory.newDAOWithKillSwitch(root, issuesRegistryBase.address)
        dao = Kernel.at(getEventArgument(daoFactoryReceipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

        const initializeData = appBase.contract.initialize.getData(owner)
        const receipt = await dao.newAppInstance(SAMPLE_APP_ID, appBase.address, initializeData, false, { from: root })
        app = KillSwitchedApp.at(getNewProxyAddress(receipt))
        await acl.createPermission(owner, app.address, WRITER_ROLE, root, { from: root })

        // upgrade kernel to non-compliant implementation
        await dao.setApp(CORE_NAMESPACE, KERNEL_APP_ID, kernelWithNonCompliantKillSwitchBase.address, { from: root })
      })

      context('when the function being called is not tagged', () => {
        it('executes the call', async () => {
          assert.equal(await app.read(), 42)
        })
      })

      context('when the function being called is tagged', () => {
        it('does not execute the call', async () => {
          await assertRevert(app.write(10, { from: owner }), 'APP_AUTH_FAILED')
        })
      })
    })

    context('when the kernel is initialized with a failing kill-switch implementation', async () => {
      let killSwitch, defaultIssuesRegistry

      before('create DAO factory', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, failingKillSwitchBase.address, registryFactory.address)
      })

      before('create issues registry', async () => {
        const daoReceipt = await daoFactory.newDAO(root)
        const issuesRegistryDAO = Kernel.at(getEventArgument(daoReceipt, 'DeployDAO', 'dao'))
        const issuesRegistryACL = ACL.at(await issuesRegistryDAO.acl())

        await issuesRegistryACL.createPermission(root, issuesRegistryDAO.address, APP_MANAGER_ROLE, root, { from: root })

        const initializeData = issuesRegistryBase.contract.initialize.getData()
        const defaultRegistryReceipt = await issuesRegistryDAO.newAppInstance('0x1234', issuesRegistryBase.address, initializeData, false, { from: root })
        defaultIssuesRegistry = IssuesRegistry.at(getNewProxyAddress(defaultRegistryReceipt))
        await issuesRegistryACL.createPermission(securityPartner, defaultIssuesRegistry.address, CHANGE_SEVERITY_ROLE, root, { from: root })
      })

      beforeEach('deploy DAO with a kill switch', async () => {
        const receipt = await daoFactory.newDAOWithKillSwitch(root, defaultIssuesRegistry.address)
        dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
        killSwitch = KillSwitch.at(await dao.killSwitch())

        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_ISSUES_REGISTRY_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_WHITELISTED_INSTANCES_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_BLACKLISTED_BASE_IMPLS_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE, root, { from: root })
      })

      beforeEach('create kill switched app', async () => {
        const initializeData = appBase.contract.initialize.getData(owner)
        const receipt = await dao.newAppInstance(SAMPLE_APP_ID, appBase.address, initializeData, false, { from: root })
        app = KillSwitchedApp.at(getNewProxyAddress(receipt))
        await acl.createPermission(owner, app.address, WRITER_ROLE, root, { from: root })
      })

      const itExecutesTheCall = () => {
        it('executes the call', async () => {
          await app.write(10, { from: owner })
          assert.equal(await app.read(), 10)
        })
      }

      context('when the function being called is not tagged', () => {
        itExecutesTheCall()
      })

      context('when the function being called is tagged', () => {
        const itAlwaysExecutesTheCall = () => {
          context('when the instance being called is whitelisted', () => {
            beforeEach('whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, true, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              // Note that whitelisting a single instance has higher precedence than blacklisting a base implementation
              itExecutesTheCall()
            })
          })

          context('when the instance being called is not marked as whitelisted', () => {
            beforeEach('do not whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, false, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itExecutesTheCall()
            })
          })
        }

        context('when there is no bug registered', () => {
          itAlwaysExecutesTheCall()
        })

        context('when there is a bug registered', () => {
          beforeEach('register a bug', async () => {
            await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
          })

          context('when there is no highest whitelisted severity set for the contract being called', () => {
            itAlwaysExecutesTheCall()
          })

          context('when there is a highest whitelisted severity set for the contract being called', () => {
            context('when the highest whitelisted severity is under the reported bug severity', () => {
              beforeEach('set highest whitelisted severity below the one reported', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
              })

              itAlwaysExecutesTheCall()
            })

            context('when the highest whitelisted severity is equal to the reported bug severity', () => {
              beforeEach('set highest whitelisted severity equal to the one reported', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
              })

              itAlwaysExecutesTheCall()
            })

            context('when the highest whitelisted severity is greater than the reported bug severity', () => {
              beforeEach('set highest whitelisted severity above the one reported', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.CRITICAL, { from: owner })
              })

              itAlwaysExecutesTheCall()
            })
          })
        })
      })
    })

    context('when the kernel is initialized with a safe kill-switch implementation', async () => {
      let killSwitch, defaultIssuesRegistry

      before('create DAO factory', async () => {
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, registryFactory.address)
      })

      beforeEach('create issues registries', async () => {
        const daoReceipt = await daoFactory.newDAO(root)
        const issuesRegistryDAO = Kernel.at(getEventArgument(daoReceipt, 'DeployDAO', 'dao'))
        const issuesRegistryACL = ACL.at(await issuesRegistryDAO.acl())
        await issuesRegistryACL.createPermission(root, issuesRegistryDAO.address, APP_MANAGER_ROLE, root, { from: root })

        const initializeData = issuesRegistryBase.contract.initialize.getData()
        const defaultRegistryReceipt = await issuesRegistryDAO.newAppInstance('0x1234', issuesRegistryBase.address, initializeData, false, { from: root })
        defaultIssuesRegistry = IssuesRegistry.at(getNewProxyAddress(defaultRegistryReceipt))
        await issuesRegistryACL.createPermission(securityPartner, defaultIssuesRegistry.address, CHANGE_SEVERITY_ROLE, root, { from: root })
      })

      beforeEach('deploy DAO with a kill switch', async () => {
        const receipt = await daoFactory.newDAOWithKillSwitch(root, defaultIssuesRegistry.address)
        dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
        acl = ACL.at(await dao.acl())
        killSwitch = KillSwitch.at(await dao.killSwitch())
        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_ISSUES_REGISTRY_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_WHITELISTED_INSTANCES_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_BLACKLISTED_BASE_IMPLS_ROLE, root, { from: root })
        await acl.createPermission(owner, killSwitch.address, CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE, root, { from: root })
      })

      beforeEach('create kill switched app', async () => {
        const initializeData = appBase.contract.initialize.getData(owner)
        const receipt = await dao.newAppInstance(SAMPLE_APP_ID, appBase.address, initializeData, false, { from: root })
        app = KillSwitchedApp.at(getNewProxyAddress(receipt))
        await acl.createPermission(owner, app.address, WRITER_ROLE, root, { from: root })
      })

      context('when the function being called is not tagged', () => {

        const itExecutesTheCallEvenWhenBaseImplementationIsBlacklisted = () => {
          const itExecutesTheCall = () => {
            it('executes the call', async () => {
              assert.equal(await app.read(), 42)
            })
          }

          context('when the instance being called is whitelisted', () => {
            beforeEach('whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, true, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itExecutesTheCall()
            })
          })

          context('when the instance being called is not marked as whitelisted', () => {
            beforeEach('dot not whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, false, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itExecutesTheCall()
            })
          })
        }

        context('when there is no bug registered', () => {
          itExecutesTheCallEvenWhenBaseImplementationIsBlacklisted()
        })

        context('when there is a bug registered', () => {
          beforeEach('register a bug', async () => {
            await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
          })

          itExecutesTheCallEvenWhenBaseImplementationIsBlacklisted()
        })
      })

      context('when the function being called is tagged', () => {
        const itExecutesTheCall = () => {
          it('executes the call', async () => {
            await app.write(10, { from: owner })
            assert.equal(await app.read(), 10)
          })
        }

        const itDoesNotExecuteTheCall = () => {
          it('does not execute the call', async () => {
            await assertRevert(app.write(10, { from: owner }), 'APP_AUTH_FAILED')
          })
        }

        const itExecutesTheCallOnlyWhenWhitelisted = () => {
          context('when the instance being called is whitelisted', () => {
            beforeEach('whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, true, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itExecutesTheCall()
            })
          })

          context('when the instance being called is not marked as whitelisted', () => {
            beforeEach('dot not whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, false, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itDoesNotExecuteTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itDoesNotExecuteTheCall()
            })
          })
        }

        const itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted = () => {
          context('when the instance being called is whitelisted', () => {
            beforeEach('whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, true, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itExecutesTheCall()
            })
          })

          context('when the instance being called is not marked as whitelisted', () => {
            beforeEach('dot not whitelist instance', async () => {
              await killSwitch.setWhitelistedInstance(app.address, false, { from: owner })
            })

            context('when the base implementation is not blacklisted', () => {
              beforeEach('do not blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the base implementation is blacklisted', () => {
              beforeEach('blacklist base implementation', async () => {
                await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
              })

              itDoesNotExecuteTheCall()
            })
          })
        }

        context('when there is no bug registered', () => {
          itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
        })

        context('when there is a bug registered', () => {
          beforeEach('register a bug', async () => {
            await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
          })

          context('when the bug was real', () => {
            context('when there is no highest allowed severity set for the contract being called', () => {
              itExecutesTheCallOnlyWhenWhitelisted()
            })

            context('when there is a highest allowed severity set for the contract being called', () => {
              context('when the highest allowed severity is under the reported bug severity', () => {
                beforeEach('set highest allowed severity below the one reported', async () => {
                  await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
                })

                itExecutesTheCallOnlyWhenWhitelisted()
              })

              context('when the highest allowed severity is equal to the reported bug severity', () => {
                beforeEach('set highest allowed severity equal to the one reported', async () => {
                  await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
                })

                itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
              })

              context('when the highest allowed severity is greater than the reported bug severity', () => {
                beforeEach('set highest allowed severity above the one reported', async () => {
                  await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.CRITICAL, { from: owner })
                })

                itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
              })
            })
          })

          context('when the bug was a false positive', () => {
            beforeEach('roll back reported bug', async () => {
              await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
            })

            context('when there is no highest allowed severity set for the contract being called', () => {
              itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
            })

            context('when there is a highest allowed severity set for the contract being called', () => {
              context('when the highest allowed severity is under the reported bug severity', () => {
                beforeEach('set highest allowed severity below the one reported', async () => {
                  await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
                })

                itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
              })

              context('when the highest allowed severity is equal to the reported bug severity', () => {
                beforeEach('set highest allowed severity equal to the one reported', async () => {
                  await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
                })

                itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
              })

              context('when the highest allowed severity is greater than the reported bug severity', () => {
                beforeEach('set highest allowed severity above the one reported', async () => {
                  await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.CRITICAL, { from: owner })
                })

                itExecutesTheCallUnlessInstanceNotWhitelistedAndBaseBlacklisted()
              })
            })
          })
        })
      })
    })
  })
})
