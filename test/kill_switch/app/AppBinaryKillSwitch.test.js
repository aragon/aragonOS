const { assertRevert } = require('../../helpers/assertThrow')
const itBehavesLikeBinaryKillSwitch = require('../base/itBehavesLikeBinaryKillSwitch')

const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('AppKillSwitchedAppMock')
const AppBinaryKillSwitch = artifacts.require('AppBinaryKillSwitchMock')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

const SEVERITY = { NONE: 0, LOW: 1, MID: 2, HIGH: 3, CRITICAL: 4 }

const getEventArgument = (receipt, event, arg) => receipt.logs.find(l => l.event === event).args[arg]

contract('AppBinaryKillSwitch', ([_, root, owner, securityPartner, anyone]) => {
  let kernelBase, aclBase, appBase, appKillSwitchBase, issuesRegistryBase
  let registryFactory, dao, acl, issuesRegistry, app, appKillSwitch

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    registryFactory = await EVMScriptRegistryFactory.new()
    appKillSwitchBase = await AppBinaryKillSwitch.new()
    issuesRegistryBase = await IssuesRegistry.new()
    appBase = await KillSwitchedApp.new()
  })

  before('deploy DAO', async () => {
    const daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, registryFactory.address)
    const kernelReceipt = await daoFactory.newDAO(root)
    dao = Kernel.at(getEventArgument(kernelReceipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())
    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
  })

  beforeEach('create issues registry', async () => {
    const issuesRegistryReceipt = await dao.newAppInstance('0x1234', issuesRegistryBase.address, '0x', false, { from: root })
    issuesRegistry = IssuesRegistry.at(getEventArgument(issuesRegistryReceipt, 'NewAppProxy', 'proxy'))
    await issuesRegistry.initialize()
    const SET_ENTRY_SEVERITY_ROLE = await issuesRegistryBase.SET_ENTRY_SEVERITY_ROLE()
    await acl.createPermission(securityPartner, issuesRegistry.address, SET_ENTRY_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('create app kill switch', async () => {
    const appKillSwitchReceipt = await dao.newAppInstance('0x1235', appKillSwitchBase.address, '0x', false, { from: root })
    appKillSwitch = AppBinaryKillSwitch.at(getEventArgument(appKillSwitchReceipt, 'NewAppProxy', 'proxy'))
    await appKillSwitch.initialize(issuesRegistry.address)
    const SET_IGNORED_CONTRACTS_ROLE = await appKillSwitchBase.SET_IGNORED_CONTRACTS_ROLE()
    await acl.createPermission(owner, appKillSwitch.address, SET_IGNORED_CONTRACTS_ROLE, root, { from: root })
  })

  beforeEach('create kill switched app', async () => {
    const appReceipt = await dao.newAppInstance('0x1236', appBase.address, '0x', false, { from: root })
    app = KillSwitchedApp.at(getEventArgument(appReceipt, 'NewAppProxy', 'proxy'))
    await app.initialize(appKillSwitch.address, owner)
  })

  describe('binary kill switch', function () {
    beforeEach('bind kill switch', function () {
      this.killSwitch = appKillSwitch
    })

    itBehavesLikeBinaryKillSwitch(owner, anyone)
  })

  describe('integration', () => {
    context('when the function being called is not tagged', () => {
      const itExecutesTheCall = () => {
        it('executes the call', async () => {
          assert.equal(await app.read(), 42)
        })
      }

      context('when there is no bug registered', () => {
        context('when the contract being called is not ignored', () => {
          itExecutesTheCall()
        })

        context('when the contract being called is ignored', () => {
          beforeEach('ignore calling contract', async () => {
            await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
          })

          itExecutesTheCall()
        })
      })

      context('when there is a bug registered', () => {
        beforeEach('register a bug', async () => {
          await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.LOW, { from: securityPartner })
        })

        context('when the contract being called is not ignored', () => {
          itExecutesTheCall()
        })

        context('when the contract being called is ignored', () => {
          beforeEach('ignore calling contract', async () => {
            await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
          })

          itExecutesTheCall()
        })
      })
    })

    context('when the function being called is tagged', () => {
      context('when the function being called is always evaluated', () => {
        const itExecutesTheCall = (from = owner) => {
          it('executes the call', async () => {
            await app.write(10, { from })
            assert.equal(await app.read(), 10)
          })
        }

        const itDoesNotExecuteTheCall = (from = owner) => {
          it('does not execute the call', async () => {
            await assertRevert(app.write(10, { from }), 'APP_CONTRACT_CALL_NOT_ALLOWED')
          })
        }

        context('when there is no bug registered', () => {
          context('when the contract being called is not ignored', () => {
            itExecutesTheCall()
          })

          context('when the contract being called is ignored', () => {
            beforeEach('ignore calling contract', async () => {
              await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
            })

            itExecutesTheCall()
          })
        })

        context('when there is a bug registered', () => {
          beforeEach('register a bug', async () => {
            await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.LOW, { from: securityPartner })
          })

          context('when the bug was not fixed yet', () => {
            context('when the contract being called is not ignored', () => {
              context('when the sender is the owner', () => {
                itDoesNotExecuteTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itDoesNotExecuteTheCall(anyone)
              })
            })

            context('when the contract being called is ignored', () => {
              beforeEach('ignore calling contract', async () => {
                await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
              })

              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itExecutesTheCall(anyone)
              })
            })
          })

          context('when the bug was already fixed', () => {
            beforeEach('fix bug', async () => {
              await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
            })

            context('when the contract being called is not ignored', () => {
              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itExecutesTheCall(anyone)
              })
            })

            context('when the contract being called is ignored', () => {
              beforeEach('ignore calling contract', async () => {
                await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
              })

              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itExecutesTheCall(anyone)
              })
            })
          })
        })
      })

      context('when the function being called is evaluated only when the sender is not the owner', () => {
        const itExecutesTheCall = (from = owner) => {
          it('executes the call', async () => {
            await app.reset({ from })
            assert.equal(await app.read(), 0)
          })
        }

        const itDoesNotExecuteTheCall = (from = owner) => {
          it('does not execute the call', async () => {
            await assertRevert(app.reset({ from }), 'APP_CONTRACT_CALL_NOT_ALLOWED')
          })
        }

        context('when there is no bug registered', () => {
          context('when the contract being called is not ignored', () => {
            itExecutesTheCall()
          })

          context('when the contract being called is ignored', () => {
            beforeEach('ignore calling contract', async () => {
              await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
            })

            itExecutesTheCall()
          })
        })

        context('when there is a bug registered', () => {
          beforeEach('register a bug', async () => {
            await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.LOW, { from: securityPartner })
          })

          context('when the bug was not fixed yet', () => {
            context('when the contract being called is not ignored', () => {
              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itDoesNotExecuteTheCall(anyone)
              })
            })

            context('when the contract being called is ignored', () => {
              beforeEach('ignore calling contract', async () => {
                await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
              })

              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itExecutesTheCall(anyone)
              })
            })
          })

          context('when the bug was already fixed', () => {
            beforeEach('fix bug', async () => {
              await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
            })

            context('when the contract being called is not ignored', () => {
              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itExecutesTheCall(anyone)
              })
            })

            context('when the contract being called is ignored', () => {
              beforeEach('ignore calling contract', async () => {
                await appKillSwitch.setContractIgnore(appBase.address, true, { from: owner })
              })

              context('when the sender is the owner', () => {
                itExecutesTheCall(owner)
              })

              context('when the sender is not the owner', () => {
                itExecutesTheCall(anyone)
              })
            })
          })
        })
      })
    })
  })
})
