const { ACTION, SEVERITY } = require('./enums')
const { assertRevert } = require('../helpers/assertThrow')
const { getEventArgument } = require('../helpers/events')

const KillSwitch = artifacts.require('KillSwitch')
const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('KillSwitchedAppMock')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('KillSwitch', ([_, root, owner, securityPartner]) => {
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
    const SET_HIGHEST_ALLOWED_SEVERITY_ROLE = await killSwitchBase.SET_HIGHEST_ALLOWED_SEVERITY_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_HIGHEST_ALLOWED_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('create kill switched app', async () => {
    const receipt = await dao.newAppInstance('0x1236', appBase.address, '0x', false, { from: root })
    app = KillSwitchedApp.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    await app.initialize(killSwitch.address, owner)
  })

  describe('isContractIgnored', function () {
    context('when the contract is checked', function () {
      it('returns false', async function () {
        assert.isFalse(await killSwitch.isContractIgnored(appBase.address))
      })
    })

    context('when the contract is ignored', function () {
      beforeEach('ignore contract', async function () {
        await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
      })

      it('returns true', async function () {
        assert.isTrue(await killSwitch.isContractIgnored(appBase.address))
      })
    })
  })

  describe('isContractDenied', function () {
    context('when the contract is not denied', function () {
      it('returns false', async function () {
        assert.isFalse(await killSwitch.isContractDenied(appBase.address))
      })
    })

    context('when the contract is ignored', function () {
      beforeEach('ignore contract', async function () {
        await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
      })

      it('returns true', async function () {
        assert.isTrue(await killSwitch.isContractDenied(appBase.address))
      })
    })
  })

  describe('setContractAction', function () {
    context('when the sender is the owner', function () {
      const from = owner

      context('when there was no action set yet', function () {
        it('sets a new action', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from })

          assert.equal(await killSwitch.getContractAction(appBase.address), ACTION.DENY)
        })
      })

      context('when there was an action already set', function () {
        beforeEach('deny contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from })
          assert.equal(await killSwitch.getContractAction(appBase.address), ACTION.DENY)
        })

        it('changes the contract action', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from })

          assert.equal(await killSwitch.getContractAction(appBase.address), ACTION.IGNORE)
        })
      })
    })

    context('when the sender is not the owner', function () {
      it('reverts', async function () {
        await assertRevert(killSwitch.setContractAction(appBase.address, ACTION.DENY))
      })
    })
  })

  describe('isSeverityIgnored', function () {
    context('when there is no bug registered', () => {
      context('when there is no highest allowed severity set for the contract being called', () => {
        it('returns true', async () => {
          assert.isTrue(await killSwitch.isSeverityIgnored(appBase.address))
        })
      })

      context('when there is a highest allowed severity set for the contract being called', () => {
        beforeEach('set highest allowed severity', async () => {
          await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
        })

        it('returns true', async () => {
          assert.isTrue(await killSwitch.isSeverityIgnored(appBase.address))
        })
      })
    })

    context('when there is a bug registered', () => {
      beforeEach('register a bug', async () => {
        await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
      })

      context('when there is no highest allowed severity set for the contract being called', () => {
        it('returns false', async () => {
          assert.isFalse(await killSwitch.isSeverityIgnored(appBase.address))
        })
      })

      context('when there is a highest allowed severity set for the contract being called', () => {
        context('when the highest allowed severity is under the reported bug severity', () => {
          beforeEach('set highest allowed severity', async () => {
            await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
          })

          it('returns false', async () => {
            assert.isFalse(await killSwitch.isSeverityIgnored(appBase.address))
          })
        })

        context('when the highest allowed severity is equal to the reported bug severity', () => {
          beforeEach('set highest allowed severity', async () => {
            await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
          })

          it('returns true', async () => {
            assert.isTrue(await killSwitch.isSeverityIgnored(appBase.address))
          })
        })

        context('when the highest allowed severity is greater than the reported bug severity', () => {
          beforeEach('set highest allowed severity', async () => {
            await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
          })

          it('returns true', async () => {
            assert.isTrue(await killSwitch.isSeverityIgnored(appBase.address))
          })
        })
      })
    })
  })

  describe('setHighestAllowedSeverity', function () {
    context('when the contract is the owner', function () {
      const from = owner

      context('when there was no severity set', function () {
        it('sets the highest allowed severity', async function () {
          await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.HIGH, { from })

          assert.equal(await killSwitch.getHighestAllowedSeverity(appBase.address), SEVERITY.HIGH)
        })
      })

      context('when there was a previous severity set', function () {
        beforeEach('set highest  allowed severity', async function () {
          await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from })
          assert.equal(await killSwitch.getHighestAllowedSeverity(appBase.address), SEVERITY.LOW)
        })

        it('changes the highest allowed severity', async function () {
          await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from })

          assert.equal(await killSwitch.getHighestAllowedSeverity(appBase.address), SEVERITY.MID)
        })
      })
    })

    context('when the sender is not the owner', function () {
      it('reverts', async function () {
        await assertRevert(killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID))
      })
    })
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
            await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
          })

          itExecutesTheCall()
        })
      }

      context('when there is no bug registered', () => {
        context('when there is no highest allowed severity set for the contract being called', () => {
          itExecutesTheCallEvenIfDenied()
        })

        context('when there is a highest allowed severity set for the contract being called', () => {
          beforeEach('set highest allowed severity', async () => {
            await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
          })

          itExecutesTheCallEvenIfDenied()
        })
      })

      context('when there is a bug registered', () => {
        beforeEach('register a bug', async () => {
          await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
        })

        context('when there is no highest allowed severity set for the contract being called', () => {
          itExecutesTheCallEvenIfDenied()
        })

        context('when there is a highest allowed severity set for the contract being called', () => {
          context('when the highest allowed severity is under the reported bug severity', () => {
            itExecutesTheCallEvenIfDenied()
          })

          context('when the highest allowed severity is equal to the reported bug severity', () => {
            beforeEach('set highest allowed severity', async () => {
              await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
            })

            itExecutesTheCallEvenIfDenied()
          })

          context('when the highest allowed severity is greater than the reported bug severity', () => {
            beforeEach('set highest allowed severity', async () => {
              await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
            })

            itExecutesTheCallEvenIfDenied()
          })
        })
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
          await assertRevert(app.write(10, { from: owner }), 'APP_CONTRACT_CALL_NOT_ALLOWED')
        })
      }

      const itExecutesTheCallWhenNotDenied = () => {
        context('when the contract being called is checked', () => {
          itExecutesTheCall()
        })

        context('when the contract being called is ignored', () => {
          beforeEach('ignore calling contract', async () => {
            await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
          })

          itExecutesTheCall()
        })

        context('when the contract being called is denied', () => {
          beforeEach('deny calling contract', async () => {
            await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
          })

          itDoesNotExecuteTheCall()
        })
      }

      context('when there is no bug registered', () => {
        context('when there is no highest allowed severity set for the contract being called', () => {
          itExecutesTheCallWhenNotDenied()
        })

        context('when there is a highest allowed severity set for the contract being called', () => {
          beforeEach('set highest allowed severity', async () => {
            await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
          })

          itExecutesTheCallWhenNotDenied()
        })
      })

      context('when there is a bug registered', () => {
        beforeEach('register a bug', async () => {
          await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
        })

        context('when the bug was not fixed yet', () => {
          context('when there is no highest allowed severity set for the contract being called', () => {
            context('when the contract being called is checked', () => {
              itDoesNotExecuteTheCall()
            })

            context('when the contract being called is ignored', () => {
              beforeEach('ignore calling contract', async () => {
                await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
              })

              itExecutesTheCall()
            })

            context('when the contract being called is denied', () => {
              beforeEach('deny calling contract', async () => {
                await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
              })

              itDoesNotExecuteTheCall()
            })
          })

          context('when there is a highest allowed severity set for the contract being called', () => {
            context('when the highest allowed severity is under the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
              })

              context('when the contract being called is checked', () => {
                itDoesNotExecuteTheCall()
              })

              context('when the contract being called is ignored', () => {
                beforeEach('ignore calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.IGNORE, { from: owner })
                })

                itExecutesTheCall()
              })

              context('when the contract being called is denied', () => {
                beforeEach('deny calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                })

                itDoesNotExecuteTheCall()
              })
            })

            context('when the highest allowed severity is equal to the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
              })

              itExecutesTheCallWhenNotDenied()
            })

            context('when the highest allowed severity is greater than the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
              })

              itExecutesTheCallWhenNotDenied()
            })
          })
        })

        context('when the bug was already fixed', () => {
          beforeEach('fix bug', async () => {
            await issuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
          })

          context('when there is no highest allowed severity set for the contract being called', () => {
            itExecutesTheCallWhenNotDenied()
          })

          context('when there is a highest allowed severity set for the contract being called', () => {
            context('when the highest allowed severity is under the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
              })

              itExecutesTheCallWhenNotDenied()
            })

            context('when the highest allowed severity is equal to the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
              })

              itExecutesTheCallWhenNotDenied()
            })

            context('when the highest allowed severity is greater than the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.CRITICAL, { from: owner })
              })

              itExecutesTheCallWhenNotDenied()
            })
          })
        })
      })
    })
  })
})
