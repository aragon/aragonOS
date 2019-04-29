const { ACTION, SEVERITY } = require('../helpers/enums')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument } = require('../helpers/events')
const itBehavesLikeSeveritiesKillSwitch = require('../base/itBehavesLikeSeveritiesKillSwitch')

const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('AppKillSwitchedAppMock')
const AppSeveritiesKillSwitch = artifacts.require('AppSeveritiesKillSwitchMock')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('AppSeveritiesKillSwitch', ([_, root, owner, securityPartner, anyone]) => {
  let kernelBase, aclBase, appBase, appKillSwitchBase, issuesRegistryBase
  let registryFactory, dao, acl, issuesRegistry, app, appKillSwitch

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    registryFactory = await EVMScriptRegistryFactory.new()
    appKillSwitchBase = await AppSeveritiesKillSwitch.new()
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
    appKillSwitch = AppSeveritiesKillSwitch.at(getEventArgument(appKillSwitchReceipt, 'NewAppProxy', 'proxy'))
    await appKillSwitch.initialize(issuesRegistry.address)
    const SET_CONTRACT_ACTION_ROLE = await appKillSwitchBase.SET_CONTRACT_ACTION_ROLE()
    await acl.createPermission(owner, appKillSwitch.address, SET_CONTRACT_ACTION_ROLE, root, { from: root })
    const SET_LOWEST_ALLOWED_SEVERITY_ROLE = await appKillSwitchBase.SET_LOWEST_ALLOWED_SEVERITY_ROLE()
    await acl.createPermission(owner, appKillSwitch.address, SET_LOWEST_ALLOWED_SEVERITY_ROLE, root, { from: root })
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

    itBehavesLikeSeveritiesKillSwitch(owner, anyone)
  })

  describe('integration', () => {
    context('when the function being called is not tagged', () => {

      const itExecutesTheCallEvenIfDenied = () => {
        const itExecutesTheCall = () => {
          it('executes the call', async () => {
            assert.equal(await app.read(), 42)
          })
        }

        context('when the contract being called is not denied', () => {
          itExecutesTheCall()
        })

        context('when the contract being called is denied', () => {
          beforeEach('deny calling contract', async () => {
            await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
          })

          itExecutesTheCall()
        })
      }

      context('when there is no bug registered', () => {
        context('when there is no lowest allowed severity set for the contract being called', () => {
          itExecutesTheCallEvenIfDenied()
        })

        context('when there is a lowest allowed severity set for the contract being called', () => {
          beforeEach('set lowest allowed severity', async () => {
            await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
          })

          itExecutesTheCallEvenIfDenied()
        })
      })

      context('when there is a bug registered', () => {
        beforeEach('register a bug', async () => {
          await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
        })

        context('when there is no lowest allowed severity set for the contract being called', () => {
          itExecutesTheCallEvenIfDenied()
        })

        context('when there is a lowest allowed severity set for the contract being called', () => {
          context('when the lowest allowed severity is under the reported bug severity', () => {
            itExecutesTheCallEvenIfDenied()
          })

          context('when the lowest allowed severity is equal to the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
            })

            itExecutesTheCallEvenIfDenied()
          })

          context('when the lowest allowed severity is greater than the reported bug severity', () => {
            beforeEach('set lowest allowed severity', async () => {
              await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
            })

            itExecutesTheCallEvenIfDenied()
          })
        })
      })
    })

    context('when the function being called is tagged', () => {
      describe('when the function being called is always evaluated', () => {
        const itExecutesTheCall = () => {
          it('executes the call', async () => {
            await app.write(10, { from: owner })
            assert.equal(await app.read(), 10)
          })
        }

        const itDoesNotExecuteTheCall = () => {
          it('does not execute the call', async () => {
            await assertRevert(app.write(10, { from: owner }), 'APP_CONTRACT_CALL_NOT_ALLOWED')
          })
        }

        const itExecutesTheCallWhenNotDenied = () => {
          context('when the contract being called is checked', () => {
            itExecutesTheCall()
          })

          context('when the contract being called is ignored', () => {
            beforeEach('ignore calling contract', async () => {
              await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
            })

            itExecutesTheCall()
          })

          context('when the contract being called is denied', () => {
            beforeEach('deny calling contract', async () => {
              await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
            })

            itDoesNotExecuteTheCall()
          })
        }

        context('when there is no bug registered', () => {
          context('when there is no lowest allowed severity set for the contract being called', () => {
            itExecutesTheCallWhenNotDenied()
          })

          context('when there is a lowest allowed severity set for the contract being called', () => {
            beforeEach('set lowest allowed severity', async () => {
              await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
            })

            itExecutesTheCallWhenNotDenied()
          })
        })

        context('when there is a bug registered', () => {
          beforeEach('register a bug', async () => {
            await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
          })

          context('when the bug was not fixed yet', () => {
            context('when there is no lowest allowed severity set for the contract being called', () => {
              context('when the contract being called is checked', () => {
                itDoesNotExecuteTheCall()
              })

              context('when the contract being called is ignored', () => {
                beforeEach('ignore calling contract', async () => {
                  await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
                })

                itExecutesTheCall()
              })

              context('when the contract being called is denied', () => {
                beforeEach('deny calling contract', async () => {
                  await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                })

                itDoesNotExecuteTheCall()
              })
            })

            context('when there is a lowest allowed severity set for the contract being called', () => {
              context('when the lowest allowed severity is under the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
                })

                context('when the contract being called is checked', () => {
                  itDoesNotExecuteTheCall()
                })

                context('when the contract being called is ignored', () => {
                  beforeEach('ignore calling contract', async () => {
                    await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
                  })

                  itExecutesTheCall()
                })

                context('when the contract being called is denied', () => {
                  beforeEach('deny calling contract', async () => {
                    await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                  })

                  itDoesNotExecuteTheCall()
                })
              })

              context('when the lowest allowed severity is equal to the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
                })

                itExecutesTheCallWhenNotDenied()
              })

              context('when the lowest allowed severity is greater than the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
                })

                itExecutesTheCallWhenNotDenied()
              })
            })
          })

          context('when the bug was already fixed', () => {
            beforeEach('fix bug', async () => {
              await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
            })

            context('when there is no lowest allowed severity set for the contract being called', () => {
              itExecutesTheCallWhenNotDenied()
            })

            context('when there is a lowest allowed severity set for the contract being called', () => {
              context('when the lowest allowed severity is under the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
                })

                itExecutesTheCallWhenNotDenied()
              })

              context('when the lowest allowed severity is equal to the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
                })

                itExecutesTheCallWhenNotDenied()
              })

              context('when the lowest allowed severity is greater than the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
                })

                itExecutesTheCallWhenNotDenied()
              })
            })
          })
        })
      })

      describe('when the function being called is evaluated only when the sender is not the owner', () => {
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
              await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
            })

            itExecutesTheCall(from)
          })

          context('when the contract being called is denied', () => {
            beforeEach('deny calling contract', async () => {
              await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
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
              await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
            })

            itExecutesTheCall(from)
          })

          context('when the contract being called is denied', () => {
            beforeEach('deny calling contract', async () => {
              await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
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
              await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
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
                    await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
                  })

                  itExecutesTheCall(anyone)
                })

                context('when the contract being called is denied', () => {
                  beforeEach('deny calling contract', async () => {
                    await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                  })

                  itDoesNotExecuteTheCall(anyone)
                })
              })
            })

            context('when there is a lowest allowed severity set for the contract being called', () => {
              context('when the lowest allowed severity is under the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
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
                      await appKillSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
                    })

                    itExecutesTheCall(anyone)
                  })

                  context('when the contract being called is denied', () => {
                    beforeEach('deny calling contract', async () => {
                      await appKillSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                    })

                    itDoesNotExecuteTheCall(anyone)
                  })
                })
              })

              context('when the lowest allowed severity is equal to the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
                })

                itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
              })

              context('when the lowest allowed severity is greater than the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
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
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
                })

                itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
              })

              context('when the lowest allowed severity is equal to the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
                })

                itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
              })

              context('when the lowest allowed severity is greater than the reported bug severity', () => {
                beforeEach('set lowest allowed severity', async () => {
                  await appKillSwitch.setLowestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
                })

                itExecutesTheCallUnlessItsDeniedAndSenderIsNotOwner()
              })
            })
          })
        })
      })
    })
  })
})
