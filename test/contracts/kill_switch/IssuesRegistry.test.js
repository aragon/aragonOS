const { SEVERITY } = require('./enums')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument } = require('../../helpers/events')

const IssuesRegistry = artifacts.require('IssuesRegistry')
const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KillSwitch = artifacts.require('KillSwitch')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('IssuesRegistry', ([_, root, implementation, owner, anyone]) => {
  let kernelBase, aclBase, issuesRegistryBase, registryFactory, dao, acl, issuesRegistry, killSwitchBase

  before('deploy base implementations', async () => {
    kernelBase = await Kernel.new(true) // petrify immediately
    aclBase = await ACL.new()
    killSwitchBase = await KillSwitch.new()
    registryFactory = await EVMScriptRegistryFactory.new()
    issuesRegistryBase = await IssuesRegistry.new()
  })

  before('deploy DAO', async () => {
    const daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, killSwitchBase.address, registryFactory.address)
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
    const SET_SEVERITY_ROLE = await issuesRegistryBase.SET_SEVERITY_ROLE()
    await acl.createPermission(owner, issuesRegistry.address, SET_SEVERITY_ROLE, root, { from: root })
  })

  describe('isSeverityFor', () => {
    context('when there was no severity set before', () => {
      it('returns false', async () => {
        assert.isFalse(await issuesRegistry.isSeverityFor(implementation), 'did not expect severity for given implementation')
      })
    })

    context('when there was a severity already set', () => {
      beforeEach('set medium severity', async () => {
        await issuesRegistry.setSeverityFor(implementation, SEVERITY.LOW, { from: owner })
      })

      context('when the issues was not fixed yet', () => {
        it('returns true', async () => {
          assert.isTrue(await issuesRegistry.isSeverityFor(implementation), 'did not expect severity for given implementation')
        })
      })

      context('when the issues was already fixed', () => {
        beforeEach('set medium severity', async () => {
          await issuesRegistry.setSeverityFor(implementation, SEVERITY.NONE, { from: owner })
        })

        it('returns false', async () => {
          assert.isFalse(await issuesRegistry.isSeverityFor(implementation), 'did not expect severity for given implementation')
        })
      })
    })
  })

  describe('getSeverityFor', () => {
    context('when there was no severity set before', () => {
      it('returns none', async () => {
        assert.equal(await issuesRegistry.getSeverityFor(implementation), SEVERITY.NONE, 'severity does not match')
      })
    })

    context('when there was a severity already set', () => {
      beforeEach('set medium severity', async () => {
        await issuesRegistry.setSeverityFor(implementation, SEVERITY.MID, { from: owner })
      })

      it('returns the severity already set', async () => {
        assert.equal(await issuesRegistry.getSeverityFor(implementation), SEVERITY.MID, 'severity does not match')
      })
    })
  })

  describe('setSeverityFor', () => {
    context('when the sender is the owner', () => {
      const from = owner

      it('emits an event', async () => {
        const { logs } = await issuesRegistry.setSeverityFor(implementation, SEVERITY.LOW, { from })

        const events = logs.filter(l => l.event === 'SeveritySet')
        assert.equal(events.length, 1, 'number of SeveritySet events does not match')
        assert.equal(events[0].args.implementation, implementation, 'implementation address does not match')
        assert.equal(events[0].args.severity, SEVERITY.LOW, 'severity does not match')
        assert.equal(events[0].args.sender, owner, 'sender does not match')
      })

      context('when there was no severity set before', () => {
        it('sets the severity for the given implementation', async () => {
          await issuesRegistry.setSeverityFor(implementation, SEVERITY.MID, { from })

          assert.equal(await issuesRegistry.getSeverityFor(implementation), SEVERITY.MID, 'severity does not match')
        })
      })

      context('when there was a severity already set', () => {
        beforeEach('set medium severity', async () => {
          await issuesRegistry.setSeverityFor(implementation, SEVERITY.MID, { from })
        })

        it('changes the severity for the given implementation', async () => {
          await issuesRegistry.setSeverityFor(implementation, SEVERITY.LOW, { from })

          assert.equal(await issuesRegistry.getSeverityFor(implementation), SEVERITY.LOW, 'severity does not match')
        })
      })
    })

    context('when the sender is not the owner', () => {
      const from = anyone

      it('reverts', async () => {
        await assertRevert(issuesRegistry.setSeverityFor(implementation, SEVERITY.LOW, { from }))
      })
    })
  })
})
