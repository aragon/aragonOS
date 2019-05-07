const { ACTION, SEVERITY } = require('./enums')
const { skipCoverage } = require('../../helpers/coverage')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEvents, getEvent, getEventArgument } = require('../../helpers/events')

const KillSwitch = artifacts.require('KillSwitch')
const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('KillSwitchedAppMock')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

contract('KillSwitch', ([_, root, owner, securityPartner, anyone]) => {
  let kernelBase, aclBase, appBase, killSwitchBase, issuesRegistryBase
  let registryFactory, dao, acl, defaultIssuesRegistry, specificIssuesRegistry, app, killSwitch

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    registryFactory = await EVMScriptRegistryFactory.new()
    killSwitchBase = await KillSwitch.new()
    issuesRegistryBase = await IssuesRegistry.new()
    appBase = await KillSwitchedApp.new()
  })

  beforeEach('create issues registries', async () => {
    const daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, registryFactory.address)
    const daoReceipt = await daoFactory.newDAO(root)
    const issuesRegistryDAO = Kernel.at(getEventArgument(daoReceipt, 'DeployDAO', 'dao'))
    const issuesRegistryACL = ACL.at(await issuesRegistryDAO.acl())

    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await issuesRegistryACL.createPermission(root, issuesRegistryDAO.address, APP_MANAGER_ROLE, root, { from: root })

    const SET_SEVERITY_ROLE = await issuesRegistryBase.SET_SEVERITY_ROLE()

    const defaultRegistryReceipt = await issuesRegistryDAO.newAppInstance('0x1234', issuesRegistryBase.address, '0x', false, { from: root })
    defaultIssuesRegistry = IssuesRegistry.at(getEventArgument(defaultRegistryReceipt, 'NewAppProxy', 'proxy'))
    await defaultIssuesRegistry.initialize()
    await issuesRegistryACL.createPermission(securityPartner, defaultIssuesRegistry.address, SET_SEVERITY_ROLE, root, { from: root })

    const specificRegistryReceipt = await issuesRegistryDAO.newAppInstance('0x1234', issuesRegistryBase.address, '0x', false, { from: root })
    specificIssuesRegistry = IssuesRegistry.at(getEventArgument(specificRegistryReceipt, 'NewAppProxy', 'proxy'))
    await specificIssuesRegistry.initialize()
    await issuesRegistryACL.createPermission(securityPartner, specificIssuesRegistry.address, SET_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('deploy DAO', async () => {
    const daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, registryFactory.address)
    const receipt = await daoFactory.newDAOWithKillSwitch(root, defaultIssuesRegistry.address)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))

    acl = ACL.at(await dao.acl())
    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

    killSwitch = KillSwitch.at(await dao.killSwitch())
    const SET_DEFAULT_ISSUES_REGISTRY_ROLE = await killSwitchBase.SET_DEFAULT_ISSUES_REGISTRY_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_DEFAULT_ISSUES_REGISTRY_ROLE, root, { from: root })

    const SET_ISSUES_REGISTRY_ROLE = await killSwitchBase.SET_ISSUES_REGISTRY_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_ISSUES_REGISTRY_ROLE, root, { from: root })

    const SET_CONTRACT_ACTION_ROLE = await killSwitchBase.SET_CONTRACT_ACTION_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_CONTRACT_ACTION_ROLE, root, { from: root })

    const SET_HIGHEST_ALLOWED_SEVERITY_ROLE = await killSwitchBase.SET_HIGHEST_ALLOWED_SEVERITY_ROLE()
    await acl.createPermission(owner, killSwitch.address, SET_HIGHEST_ALLOWED_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('create kill switched app', async () => {
    const receipt = await dao.newAppInstance('0x1236', appBase.address, '0x', false, { from: root })
    app = KillSwitchedApp.at(getEventArgument(receipt, 'NewAppProxy', 'proxy'))
    await app.initialize(owner)
  })

  describe('isContractAllowed', function () {
    context('when there was no action previously set', function () {
      it('returns true', async function () {
        assert.isTrue(await killSwitch.isContractAllowed(appBase.address))
      })
    })

    context('when there was an action set', function () {
      context('when the contract is allowed', function () {
        beforeEach('allow contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, { from: owner })
        })

        it('returns true', async function () {
          assert.isTrue(await killSwitch.isContractAllowed(appBase.address))
        })
      })

      context('when the contract is being checked', function () {
        beforeEach('check contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.CHECK, { from: owner })
        })

        it('returns false', async function () {
          assert.isFalse(await killSwitch.isContractAllowed(appBase.address))
        })
      })

      context('when the contract is denied', function () {
        beforeEach('deny contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
        })

        it('returns false', async function () {
          assert.isFalse(await killSwitch.isContractAllowed(appBase.address))
        })
      })
    })
  })

  describe('isContractDenied', function () {
    context('when there was no action previously set', function () {
      it('returns false', async function () {
        assert.isFalse(await killSwitch.isContractDenied(appBase.address))
      })
    })

    context('when there was an action set', function () {
      context('when the contract is allowed', function () {
        beforeEach('allow contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, { from: owner })
        })

        it('returns false', async function () {
          assert.isFalse(await killSwitch.isContractDenied(appBase.address))
        })
      })

      context('when the contract is being checked', function () {
        beforeEach('check contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.CHECK, { from: owner })
        })

        it('returns false', async function () {
          assert.isFalse(await killSwitch.isContractDenied(appBase.address))
        })
      })

      context('when the contract is denied', function () {
        beforeEach('deny contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
        })

        it('returns true', async function () {
          assert.isTrue(await killSwitch.isContractDenied(appBase.address))
        })
      })
    })
  })

  describe('setContractAction', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when there was no action set yet', function () {
        it('sets a new action', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from })

          assert.equal(await killSwitch.getContractAction(appBase.address), ACTION.DENY)
        })

        it('emits an event', async () => {
          const receipt = await await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from })

          const events = getEvents(receipt, 'ContractActionSet')
          assert.equal(events.length, 1, 'number of ContractActionSet events does not match')

          const event = getEvent(receipt, 'ContractActionSet').args
          assert.equal(event.action, ACTION.DENY, 'action does not match')
          assert.equal(event.contractAddress, appBase.address, 'contract address does not match')
        })
      })

      context('when there was an action already set', function () {
        beforeEach('deny contract', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from })
          assert.equal(await killSwitch.getContractAction(appBase.address), ACTION.DENY)
        })

        it('changes the contract action', async function () {
          await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, { from })

          assert.equal(await killSwitch.getContractAction(appBase.address), ACTION.ALLOW)
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async function () {
        await assertRevert(killSwitch.setContractAction(appBase.address, ACTION.DENY, { from }))
      })
    })
  })

  describe('getIssuesRegistry', function () {
    context('when there was no specific issues registry set', () => {
      it('returns the default registry', async () => {
        assert.equal(await killSwitch.getIssuesRegistry(appBase.address), defaultIssuesRegistry.address)
      })
    })

    context('when there is a specific issues registry set', () => {
      beforeEach('set specific issues registry', async () => {
        await killSwitch.setIssuesRegistry(appBase.address, specificIssuesRegistry.address, { from: owner })
      })

      it('returns the default registry', async () => {
        assert.equal(await killSwitch.getIssuesRegistry(appBase.address), specificIssuesRegistry.address)
      })
    })
  })

  describe('setIssuesRegistry', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when the given address is not a contract', () => {
        it('reverts', async () => {
          await assertRevert(killSwitch.setIssuesRegistry(appBase.address, ZERO_ADDRESS, { from }))
        })
      })

      context('when the given address is a contract', () => {
        context('when there was no specific issues registry set yet', function () {
          it('sets the given implementation', async () => {
            await killSwitch.setIssuesRegistry(appBase.address, specificIssuesRegistry.address, { from })

            assert.equal(await killSwitch.getIssuesRegistry(appBase.address), specificIssuesRegistry.address)
          })

          it('emits an event', async () => {
            const receipt = await killSwitch.setIssuesRegistry(appBase.address, specificIssuesRegistry.address, { from })

            const events = getEvents(receipt, 'IssuesRegistrySet')
            assert.equal(events.length, 1, 'number of IssuesRegistrySet events does not match')

            const event = getEvent(receipt, 'IssuesRegistrySet').args
            assert.equal(event.contractAddress, appBase.address, 'contract address does not match')
            assert.equal(event.issuesRegistry, specificIssuesRegistry.address, 'issues registry address does not match')
          })
        })

        context('when there was a specific issues registry set', function () {
          beforeEach('set specific issues registry', async () => {
            await killSwitch.setIssuesRegistry(appBase.address, specificIssuesRegistry.address, { from })
          })

          it('changes the issues registry', async () => {
            await killSwitch.setIssuesRegistry(appBase.address, defaultIssuesRegistry.address, { from })

            assert.equal(await killSwitch.getIssuesRegistry(appBase.address), defaultIssuesRegistry.address)
          })
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(killSwitch.setIssuesRegistry(appBase.address, specificIssuesRegistry.address, { from }))
      })
    })
  })

  describe('setDefaultIssuesRegistry', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when the given address is not a contract', () => {
        it('reverts', async () => {
          await assertRevert(killSwitch.setDefaultIssuesRegistry(ZERO_ADDRESS, { from }))
        })
      })

      context('when the given address is a contract', () => {
        context('when there was no specific issues registry set yet', function () {
          it('sets the given implementation', async () => {
            await killSwitch.setDefaultIssuesRegistry(specificIssuesRegistry.address, { from })

            assert.equal(await killSwitch.defaultIssuesRegistry(), specificIssuesRegistry.address)
          })

          it('emits an event', async () => {
            const receipt = await killSwitch.setDefaultIssuesRegistry(specificIssuesRegistry.address, { from })

            const events = getEvents(receipt, 'DefaultIssuesRegistrySet')
            assert.equal(events.length, 1, 'number of DefaultIssuesRegistrySet events does not match')

            const event = getEvent(receipt, 'DefaultIssuesRegistrySet').args
            assert.equal(event.issuesRegistry, specificIssuesRegistry.address, 'issues registry address does not match')
          })
        })

        context('when there was a specific issues registry set', function () {
          beforeEach('set specific issues registry', async () => {
            await killSwitch.setDefaultIssuesRegistry(specificIssuesRegistry.address, { from })
            assert.equal(await killSwitch.defaultIssuesRegistry(), specificIssuesRegistry.address)
          })

          it('changes the issues registry', async () => {
            await killSwitch.setDefaultIssuesRegistry(defaultIssuesRegistry.address, { from })

            assert.equal(await killSwitch.defaultIssuesRegistry(), defaultIssuesRegistry.address)
          })
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(killSwitch.setDefaultIssuesRegistry(specificIssuesRegistry.address, { from }))
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
        await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
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
    context('when the sender is authorized', function () {
      const from = owner

      context('when there was no severity set', function () {
        it('sets the highest allowed severity', async function () {
          await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.HIGH, { from })

          assert.equal(await killSwitch.getHighestAllowedSeverity(appBase.address), SEVERITY.HIGH)
        })

        it('emits an event', async () => {
          const receipt = await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.HIGH, { from })

          const events = getEvents(receipt, 'HighestAllowedSeveritySet')
          assert.equal(events.length, 1, 'number of ContractActionSet events does not match')

          const event = getEvent(receipt, 'HighestAllowedSeveritySet').args
          assert.equal(event.contractAddress, appBase.address, 'contract address does not match')
          assert.equal(event.severity, SEVERITY.HIGH, 'highest severity does not match')
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

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async function () {
        await assertRevert(killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from }))
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

        context('when the contract being called is denied', () => {
          beforeEach('check calling contract', async () => {
            await killSwitch.setContractAction(appBase.address, ACTION.CHECK, { from: owner })
          })

          itExecutesTheCall()
        })

        context('when the contract being called is denied', () => {
          beforeEach('allow calling contract', async () => {
            await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, { from: owner })
          })

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
          await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
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
        context('when there was no action previously set', () => {
          itExecutesTheCall()
        })

        context('when there was an action set', () => {
          context('when the contract being called is being checked', () => {
            beforeEach('allow calling contract', async () => {
              await killSwitch.setContractAction(appBase.address, ACTION.CHECK, {from: owner})
            })

            itExecutesTheCall()
          })

          context('when the contract being called is allowed', () => {
            beforeEach('allow calling contract', async () => {
              await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, {from: owner})
            })

            itExecutesTheCall()
          })

          context('when the contract being called is denied', () => {
            beforeEach('deny calling contract', async () => {
              await killSwitch.setContractAction(appBase.address, ACTION.DENY, {from: owner})
            })

            itDoesNotExecuteTheCall()
          })
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
          await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
        })

        context('when the bug was not fixed yet', () => {
          context('when there is no highest allowed severity set for the contract being called', () => {
            context('when there was no action previously set', () => {
              itExecutesTheCall()
            })

            context('when there was an action set', () => {
              context('when the contract being called is allowed', () => {
                beforeEach('allow calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, { from: owner })
                })

                itExecutesTheCall()
              })

              context('when the contract being called is being checked', () => {
                beforeEach('allow calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.CHECK, {from: owner})
                })

                itDoesNotExecuteTheCall()
              })

              context('when the contract being called is denied', () => {
                beforeEach('deny calling contract', async () => {
                  await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                })

                itDoesNotExecuteTheCall()
              })
            })
          })

          context('when there is a highest allowed severity set for the contract being called', () => {
            context('when the highest allowed severity is under the reported bug severity', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.LOW, { from: owner })
              })

              context('when there was no action previously set', () => {
                itExecutesTheCall()
              })

              context('when there was an action set', () => {
                context('when the contract being called is allowed', () => {
                  beforeEach('allow calling contract', async () => {
                    await killSwitch.setContractAction(appBase.address, ACTION.ALLOW, { from: owner })
                  })

                  itExecutesTheCall()
                })

                context('when the contract being called is being checked', () => {
                  beforeEach('allow calling contract', async () => {
                    await killSwitch.setContractAction(appBase.address, ACTION.CHECK, {from: owner})
                  })

                  itDoesNotExecuteTheCall()
                })

                context('when the contract being called is denied', () => {
                  beforeEach('deny calling contract', async () => {
                    await killSwitch.setContractAction(appBase.address, ACTION.DENY, { from: owner })
                  })

                  itDoesNotExecuteTheCall()
                })
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
            await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.NONE, { from: securityPartner })
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

  describe('gas costs', () => {
    beforeEach('set an allowed severity issue', async () => {
      await killSwitch.setHighestAllowedSeverity(appBase.address, SEVERITY.MID, { from: owner })
      await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.LOW, { from: securityPartner })
    })

    it('kill switch should overload ~32k of gas to a function', skipCoverage(async () => {
      const { receipt: { cumulativeGasUsed: gasUsedWithKillSwitch } } = await app.write(10, { from: owner })
      const { receipt: { cumulativeGasUsed: gasUsedWithoutKillSwitch } } = await app.writeWithoutKillSwitch(10, { from: owner })

      const killSwitchCost = gasUsedWithKillSwitch - gasUsedWithoutKillSwitch
      assert(killSwitchCost <= 32000, 'kill switch should overload ~32k of gas')
    }))
  })
})
