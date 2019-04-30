const { ACTION, SEVERITY } = require('./enums')
const { assertRevert } = require('../helpers/assertThrow')
const { getEventArgument } = require('../helpers/events')

const KillSwitch = artifacts.require('KillSwitchMock')
const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('KillSwitchedAppMock')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('KillSwitchCustom', ([_, root, owner, securityPartner, anyone]) => {
  let kernelBase, aclBase, appBase, killSwitchBase, issuesRegistryBase
  let registryFactory, dao, acl, issuesRegistry, app, killSwitch

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    registryFactory = await EVMScriptRegistryFactory.new()
    killSwitchBase = await KillSwitch.new()
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
    const receipt = await dao.newAppInstance('0x1234', issuesRegistryBase.address, '0x', false, { from: root })
    issuesRegistry = IssuesRegistry.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    await issuesRegistry.initialize()
    const SET_ENTRY_SEVERITY_ROLE = await issuesRegistryBase.SET_ENTRY_SEVERITY_ROLE()
    await acl.createPermission(securityPartner, issuesRegistry.address, SET_ENTRY_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('create kill switch', async () => {
    const receipt = await dao.newAppInstance('0x1235', killSwitchBase.address, '0x', false, { from: root })
    killSwitch = KillSwitch.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    await killSwitch.initialize(issuesRegistry.address)
    const SET_CONTRACT_ACTION_ROLE = await killSwitchBase.SET_CONTRACT_ACTION_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_CONTRACT_ACTION_ROLE, root, { from: root })
    const SET_LOWEST_ALLOWED_SEVERITY_ROLE = await killSwitchBase.SET_LOWEST_ALLOWED_SEVERITY_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_LOWEST_ALLOWED_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('create kill switched app', async () => {
    const receipt = await dao.newAppInstance('0x1236', appBase.address, '0x', false, { from: root })
    app = KillSwitchedApp.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    await app.initialize(killSwitch.address, owner)
  })

  describe('custom kill switch handling', () => {
    const itExecutesTheCall = (from) => {
      it('executes the call', async () => {
        await app.reset({ from })
        assert.equal(await app.read(), 0)
      })
    }

    const itDoesNotExecuteTheCall = (from) => {
      it('does not execute the call', async () => {
        await assertRevert(app.reset({ from }), 'APP_CONTRACT_CALL_NOT_ALLOWED')
      })
    }

    const itExecutesTheCallEvenIfDenied = (from) => {
      context('when the contract being called is checked', () => {
        itExecutesTheCall(from)
      })

      context('when the contract being called is ignored', () => {
        beforeEach('ignore calling contract', async () => {
          await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
        })

        itExecutesTheCall(from)
      })

      context('when the contract being called is denied', () => {
        beforeEach('deny calling contract', async () => {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
        })

        itExecutesTheCall(from)
      })
    }

    const itExecutesTheCallWhenNotDenied = (from) => {
      context('when the contract being called is checked', () => {
        itExecutesTheCall(from)
      })

      context('when the contract being called is ignored', () => {
        beforeEach('ignore calling contract', async () => {
          await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
        })

        itExecutesTheCall(from)
      })

      context('when the contract being called is denied', () => {
        beforeEach('deny calling contract', async () => {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
        })

        itDoesNotExecuteTheCall(from)
      })
    }

    const itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner = () => {
      context('when the sender is the owner', () => {
        itExecutesTheCallEvenIfDenied(owner)
      })

      context('when the sender is not the owner', () => {
        itExecutesTheCallWhenNotDenied(anyone)
      })
    }

    context('when there is no bug registered', () => {
      context('when there is no lowest allowed severity set for the contract being called', () => {
        itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
      })

      context('when there is a lowest allowed severity set for the contract being called', () => {
        beforeEach('set lowest allowed severity', async () => {
          await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
        })

        itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
      })
    })

    context('when there is a bug registered', () => {
      beforeEach('register a bug', async () => {
        await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
      })

      context('when the bug was not fixed yet', () => {
        context('when there is no lowest allowed severity set for the contract being called', () => {
          context('when the sender is the owner', () => {
            itExecutesTheCallEvenIfDenied(owner)
          })

          context('when the sender is not the owner', () => {
            context('when the contract being called is checked', () => {
              itDoesNotExecuteTheCall(anyone)
            })

            context('when the contract being called is ignored', () => {
              beforeEach('ignore calling contract', async () => {
                await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
              })

              itExecutesTheCall(anyone)
            })

            context('when the contract being called is denied', () => {
              beforeEach('deny calling contract', async () => {
                await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
              })

              itDoesNotExecuteTheCall(anyone)
            })
          })
        })

        context('when there is a lowest allowed severity set for the contract being called', () => {
          context('when the lowest allowed severity is under the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
            })

            context('when the sender is the owner', () => {
              itExecutesTheCallEvenIfDenied(owner)
            })

            context('when the sender is not the owner', () => {
              context('when the contract being called is checked', () => {
                itDoesNotExecuteTheCall(anyone)
              })

              context('when the contract being called is ignored', () => {
                beforeEach('ignore calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
                })

                itExecutesTheCall(anyone)
              })

              context('when the contract being called is denied', () => {
                beforeEach('deny calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                })

                itDoesNotExecuteTheCall(anyone)
              })
            })
          })

          context('when the lowest allowed severity is equal to the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
            })

            itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
          })

          context('when the lowest allowed severity is greater than the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
            })

            itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
          })
        })
      })

      context('when the bug was already fixed', () => {
        beforeEach('fix bug', async () => {
          await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
        })

        context('when there is no lowest allowed severity set for the contract being called', () => {
          itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
        })

        context('when there is a lowest allowed severity set for the contract being called', () => {
          context('when the lowest allowed severity is under the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
            })

            itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
          })

          context('when the lowest allowed severity is equal to the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
            })

            itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
          })

          context('when the lowest allowed severity is greater than the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await killSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
            })

            itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
          })
        })
      })
    })
  })
})
