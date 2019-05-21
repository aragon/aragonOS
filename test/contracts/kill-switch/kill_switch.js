const { SEVERITY } = require('./enums')
const { skipCoverage } = require('../../helpers/coverage')
const { assertRevert } = require('../../helpers/assertThrow')
const { getNewProxyAddress } = require('../../helpers/events')
const { assertEvent, assertAmountOfEvents } = require('../../helpers/assertEvent')(web3)

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KillSwitch = artifacts.require('KillSwitch')
const IssuesRegistry = artifacts.require('IssuesRegistry')
const KillSwitchedApp = artifacts.require('KillSwitchedAppMock')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SAMPLE_APP_ID = '0x1236000000000000000000000000000000000000000000000000000000000000'

contract('KillSwitch', ([_, root, owner, securityPartner, anyone]) => {
  let kernelBase, aclBase, appBase, killSwitchBase, issuesRegistryBase
  let dao, acl, app, killSwitch, defaultIssuesRegistry, specificIssuesRegistry
  let CORE_NAMESPACE, KERNEL_APP_ID, KILL_SWITCH_APP_ID
  let APP_MANAGER_ROLE, CHANGE_SEVERITY_ROLE, CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE, CHANGE_ISSUES_REGISTRY_ROLE, CHANGE_WHITELISTED_INSTANCES_ROLE, CHANGE_BLACKLISTED_BASE_IMPLS_ROLE, CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE, WRITER_ROLE

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    killSwitchBase = await KillSwitch.new()
    issuesRegistryBase = await IssuesRegistry.new()
    appBase = await KillSwitchedApp.new()
  })

  before('load constants', async () => {
    CORE_NAMESPACE = await kernelBase.CORE_NAMESPACE()
    KERNEL_APP_ID = await kernelBase.KERNEL_APP_ID()
    KILL_SWITCH_APP_ID = await kernelBase.DEFAULT_KILL_SWITCH_APP_ID()
  })

  before('load roles', async () => {
    WRITER_ROLE = await appBase.WRITER_ROLE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    CHANGE_SEVERITY_ROLE = await issuesRegistryBase.CHANGE_SEVERITY_ROLE()
    CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE = await killSwitchBase.CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE()
    CHANGE_ISSUES_REGISTRY_ROLE = await killSwitchBase.CHANGE_ISSUES_REGISTRY_ROLE()
    CHANGE_WHITELISTED_INSTANCES_ROLE = await killSwitchBase.CHANGE_WHITELISTED_INSTANCES_ROLE()
    CHANGE_BLACKLISTED_BASE_IMPLS_ROLE = await killSwitchBase.CHANGE_BLACKLISTED_BASE_IMPLS_ROLE()
    CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE = await killSwitchBase.CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE()
  })

  beforeEach('create issues registries', async () => {
    const issuesRegistryDAO = await Kernel.new(false)
    await issuesRegistryDAO.initialize(aclBase.address, root)
    const issuesRegistryACL = ACL.at(await issuesRegistryDAO.acl())
    await issuesRegistryACL.createPermission(root, issuesRegistryDAO.address, APP_MANAGER_ROLE, root, { from: root })

    const initializeData = issuesRegistryBase.contract.initialize.getData()

    const defaultRegistryReceipt = await issuesRegistryDAO.newAppInstance('0x1234', issuesRegistryBase.address, initializeData, false, { from: root })
    defaultIssuesRegistry = IssuesRegistry.at(getNewProxyAddress(defaultRegistryReceipt))
    await issuesRegistryACL.createPermission(securityPartner, defaultIssuesRegistry.address, CHANGE_SEVERITY_ROLE, root, { from: root })

    const specificRegistryReceipt = await issuesRegistryDAO.newAppInstance('0x1234', issuesRegistryBase.address, initializeData, false, { from: root })
    specificIssuesRegistry = IssuesRegistry.at(getNewProxyAddress(specificRegistryReceipt))
    await issuesRegistryACL.createPermission(securityPartner, specificIssuesRegistry.address, CHANGE_SEVERITY_ROLE, root, { from: root })
  })

  beforeEach('deploy DAO with a kill switch', async () => {
    dao = await Kernel.new(false)
    await dao.initialize(aclBase.address, root)
    acl = ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

    const initializeData = killSwitchBase.contract.initialize.getData(defaultIssuesRegistry.address)
    const receipt = await dao.newAppInstance(KILL_SWITCH_APP_ID, killSwitchBase.address, initializeData, true, { from: root })
    killSwitch = KillSwitch.at(getNewProxyAddress(receipt))

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

  describe('isInstanceWhitelisted', function () {
    context('when there was no instance whitelisted value set yet', function () {
      it('returns false', async () => {
        assert.isFalse(await killSwitch.isInstanceWhitelisted(app.address))
      })
    })

    context('when there was an whitelisted value already set', function () {
      context('when it is whitelisted', function () {
        beforeEach('whitelist instance', async () => {
          await killSwitch.setWhitelistedInstance(app.address, true, { from: owner })
        })

        it('returns true', async () => {
          assert(await killSwitch.isInstanceWhitelisted(app.address))
        })
      })

      context('when it is not whitelisted', function () {
        beforeEach('do not whitelist instance', async () => {
          await killSwitch.setWhitelistedInstance(app.address, false, { from: owner })
        })

        it('returns false', async () => {
          assert.isFalse(await killSwitch.isInstanceWhitelisted(app.address))
        })
      })
    })
  })

  describe('setWhitelistedInstance', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when there was no instance whitelisted yet', function () {
        it('sets a new whitelisted value', async () => {
          await killSwitch.setWhitelistedInstance(app.address, true, { from })

          assert(await killSwitch.isInstanceWhitelisted(app.address))
        })

        it('emits an event', async () => {
          const receipt = await killSwitch.setWhitelistedInstance(app.address, true, { from })

          assertAmountOfEvents(receipt, 'ChangeWhitelistedInstance')
          assertEvent(receipt, 'ChangeWhitelistedInstance', { whitelisted: true, instance: app.address })
        })
      })

      context('when there was a instance already whitelisted', function () {
        beforeEach('whitelist instance', async () => {
          await killSwitch.setWhitelistedInstance(app.address, true, { from })
        })

        it('changes the whitelisted value', async () => {
          await killSwitch.setWhitelistedInstance(app.address, false, { from })

          assert.isFalse(await killSwitch.isInstanceWhitelisted(app.address))
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(killSwitch.setWhitelistedInstance(app.address, true, { from }))
      })
    })
  })

  describe('isBaseImplementationBlacklisted', function () {
    context('when there was no blacklisted value set yet', function () {
      it('returns false', async () => {
        assert.isFalse(await killSwitch.isBaseImplementationBlacklisted(appBase.address))
      })
    })

    context('when there was a blacklisted value already set', function () {
      context('when it is blacklisted', function () {
        beforeEach('blacklist base implementation', async () => {
          await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from: owner })
        })

        it('returns true', async () => {
          assert.isTrue(await killSwitch.isBaseImplementationBlacklisted(appBase.address))
        })
      })

      context('when it is not blacklisted', function () {
        beforeEach('do not blacklist base implementation', async () => {
          await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from: owner })
        })

        it('returns false', async () => {
          assert.isFalse(await killSwitch.isBaseImplementationBlacklisted(appBase.address))
        })
      })
    })
  })

  describe('setBlacklistedBaseImplementation', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when there was no base implementation blacklisted yet', function () {
        it('sets a new blacklisted value', async () => {
          await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from })

          assert(await killSwitch.isBaseImplementationBlacklisted(appBase.address))
        })

        it('emits an event', async () => {
          const receipt = await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from })

          assertAmountOfEvents(receipt, 'ChangeBlacklistedBaseImplementation')
          assertEvent(receipt, 'ChangeBlacklistedBaseImplementation', { base: appBase.address, blacklisted: true })
        })
      })

      context('when there was a base implementation already blacklisted', function () {
        beforeEach('blacklist base implementation', async () => {
          await killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from })
        })

        it('changes the blacklisted value', async () => {
          await killSwitch.setBlacklistedBaseImplementation(appBase.address, false, { from })

          assert.isFalse(await killSwitch.isBaseImplementationBlacklisted(appBase.address))
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(killSwitch.setBlacklistedBaseImplementation(appBase.address, true, { from }), 'APP_AUTH_FAILED')
      })
    })
  })

  describe('getIssuesRegistry', function () {
    context('when there was no specific issues registry set', () => {
      it('returns the default registry', async () => {
        assert.equal(await killSwitch.getIssuesRegistry(SAMPLE_APP_ID), defaultIssuesRegistry.address)
      })
    })

    context('when there is a specific issues registry set', () => {
      beforeEach('set specific issues registry', async () => {
        await killSwitch.setIssuesRegistry(SAMPLE_APP_ID, specificIssuesRegistry.address, { from: owner })
      })

      it('returns the default registry', async () => {
        assert.equal(await killSwitch.getIssuesRegistry(SAMPLE_APP_ID), specificIssuesRegistry.address)
      })
    })
  })

  describe('setIssuesRegistry', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when the given address is not a contract', () => {
        it('reverts', async () => {
          await assertRevert(killSwitch.setIssuesRegistry(SAMPLE_APP_ID, ZERO_ADDRESS, { from }))
        })
      })

      context('when the given address is a contract', () => {
        context('when there was no specific issues registry set yet', function () {
          it('sets the given implementation', async () => {
            await killSwitch.setIssuesRegistry(SAMPLE_APP_ID, specificIssuesRegistry.address, { from })

            assert.equal(await killSwitch.getIssuesRegistry(SAMPLE_APP_ID), specificIssuesRegistry.address)
          })

          it('emits an event', async () => {
            const receipt = await killSwitch.setIssuesRegistry(SAMPLE_APP_ID, specificIssuesRegistry.address, { from })

            assertAmountOfEvents(receipt, 'ChangeIssuesRegistry')
            assertEvent(receipt, 'ChangeIssuesRegistry', { appId: SAMPLE_APP_ID, issuesRegistry: specificIssuesRegistry.address })
          })
        })

        context('when there was a specific issues registry set', function () {
          beforeEach('set specific issues registry', async () => {
            await killSwitch.setIssuesRegistry(SAMPLE_APP_ID, specificIssuesRegistry.address, { from })
          })

          it('changes the issues registry', async () => {
            await killSwitch.setIssuesRegistry(SAMPLE_APP_ID, defaultIssuesRegistry.address, { from })

            assert.equal(await killSwitch.getIssuesRegistry(SAMPLE_APP_ID), defaultIssuesRegistry.address)
          })
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(killSwitch.setIssuesRegistry(SAMPLE_APP_ID, specificIssuesRegistry.address, { from }))
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

            assertAmountOfEvents(receipt, 'ChangeDefaultIssuesRegistry')
            assertEvent(receipt, 'ChangeDefaultIssuesRegistry', { issuesRegistry: specificIssuesRegistry.address })
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

  describe('hasExceededAllowedSeverity', function () {
    context('when there is no bug registered', () => {
      context('when there is no highest allowed severity set for the contract being called', () => {
        it('returns false', async () => {
          assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
        })
      })

      context('when there is a highest allowed severity set for the contract being called', () => {
        beforeEach('set highest allowed severity', async () => {
          await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
        })

        it('returns false', async () => {
          assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
        })
      })
    })

    context('when there is a bug registered in the default issues registry', () => {
      beforeEach('register a bug', async () => {
        await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.MID, { from: securityPartner })
      })

      context('when there is no specific issues registry set', () => {
        context('when there is no highest allowed severity set for the contract being called', () => {
          it('returns true', async () => {
            assert.isTrue(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
          })
        })

        context('when there is a highest allowed severity set for the contract being called', () => {
          context('when the highest allowed severity is under the reported bug severity', () => {
            beforeEach('set highest allowed severity', async () => {
              await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
            })

            it('returns true', async () => {
              assert.isTrue(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
            })
          })

          context('when the highest allowed severity is equal to the reported bug severity', () => {
            beforeEach('set highest allowed severity', async () => {
              await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
            })

            it('returns false', async () => {
              assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
            })
          })

          context('when the highest allowed severity is greater than the reported bug severity', () => {
            beforeEach('set highest allowed severity', async () => {
              await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.CRITICAL, { from: owner })
            })

            it('returns false', async () => {
              assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
            })
          })
        })
      })

      context('when there is a specific issues registry set', () => {
        beforeEach('set specific issues registry', async () => {
          await killSwitch.setIssuesRegistry(SAMPLE_APP_ID, specificIssuesRegistry.address, { from: owner })
        })

        context('when there is no bug registered in the specific issues registry', () => {
          context('when there is no highest allowed severity set for the contract being called', () => {
            it('returns false', async () => {
              assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
            })
          })

          context('when there is a highest allowed severity set for the contract being called', () => {
            context('when the highest allowed severity is under the reported bug severity of the default registry', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
              })

              it('returns false', async () => {
                assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
              })
            })

            context('when the highest allowed severity is equal to the reported bug severity of the default registry', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
              })

              it('returns false', async () => {
                assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
              })
            })

            context('when the highest allowed severity is greater than the reported bug severity of the default registry', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.CRITICAL, { from: owner })
              })

              it('returns false', async () => {
                assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
              })
            })
          })
        })

        context('when there is a bug registered in the specific issues registry higher than the one reported in the default registry', () => {
          beforeEach('register a bug', async () => {
            await specificIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.HIGH, { from: securityPartner })
          })

          context('when there is no highest allowed severity set for the contract being called', () => {
            it('returns true', async () => {
              assert.isTrue(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
            })
          })

          context('when there is a highest allowed severity set for the contract being called', () => {
            context('when the highest allowed severity is under the reported bug severity of the default registry', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from: owner })
              })

              it('returns true', async () => {
                assert.isTrue(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
              })
            })

            context('when the highest allowed severity is equal to the reported bug severity of the default registry but lower than the reported bug of the specific registry', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
              })

              it('returns true', async () => {
                assert.isTrue(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
              })
            })

            context('when the highest allowed severity is equal to the reported bug severity of the specific registry', () => {
              beforeEach('set highest allowed severity', async () => {
                await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.HIGH, { from: owner })
              })

              it('returns false', async () => {
                assert.isFalse(await killSwitch.hasExceededAllowedSeverity(SAMPLE_APP_ID, appBase.address))
              })
            })
          })
        })
      })
    })
  })

  describe('setHighestAllowedSeverity', function () {
    context('when the sender is authorized', function () {
      const from = owner

      context('when there was no severity set', function () {
        it('sets the highest allowed severity', async () => {
          await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.HIGH, { from })

          assert.equal(await killSwitch.getHighestAllowedSeverity(SAMPLE_APP_ID), SEVERITY.HIGH)
        })

        it('emits an event', async () => {
          const receipt = await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.HIGH, { from })

          assertAmountOfEvents(receipt, 'ChangeHighestAllowedSeverity')
          assertEvent(receipt, 'ChangeHighestAllowedSeverity', { appId: SAMPLE_APP_ID, severity: SEVERITY.HIGH })
        })
      })

      context('when there was a previous severity set', function () {
        beforeEach('set highest allowed severity', async () => {
          await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.LOW, { from })
          assert.equal(await killSwitch.getHighestAllowedSeverity(SAMPLE_APP_ID), SEVERITY.LOW)
        })

        it('changes the highest allowed severity', async () => {
          await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from })

          assert.equal(await killSwitch.getHighestAllowedSeverity(SAMPLE_APP_ID), SEVERITY.MID)
        })
      })
    })

    context('when the sender is not authorized', function () {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from }))
      })
    })
  })

  describe('gas costs', () => {
    beforeEach('set a highest allowed severity', async () => {
      await killSwitch.setHighestAllowedSeverity(SAMPLE_APP_ID, SEVERITY.MID, { from: owner })
      await defaultIssuesRegistry.setSeverityFor(appBase.address, SEVERITY.LOW, { from: securityPartner })
    })

    it('kill switch should overload ~27k of gas to a function', skipCoverage(async () => {
      const { receipt: { cumulativeGasUsed: gasUsedWithKillSwitch } } = await app.write(10, { from: owner })
      const { receipt: { cumulativeGasUsed: gasUsedWithoutKillSwitch } } = await app.writeWithoutKillSwitch(10, { from: owner })

      const killSwitchCost = gasUsedWithKillSwitch - gasUsedWithoutKillSwitch
      assert.isAtMost(killSwitchCost, 27000, 'kill switch should have maximum overhead of ~27k of gas')
    }))
  })
})
