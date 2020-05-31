const { assertRevert } = require('../../../helpers/assertThrow')
const { getEventArgument } = require('../../../helpers/events')
const { getNewProxyAddress } = require('../../../helpers/events')
const { assertEvent, assertAmountOfEvents } = require('../../../helpers/assertEvent')(web3)

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const DisputableApp = artifacts.require('DisputableAppMock')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('DisputableApp', ([_, owner, agreement, anotherAgreement, someone]) => {
  let disputable, disputableBase, dao, acl

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  before('deploy DAO', async () => {
    const kernelBase = await Kernel.new(true)
    const aclBase = await ACL.new()
    const registryFactory = await EVMScriptRegistryFactory.new()
    const daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, registryFactory.address)

    const receipt = await daoFact.newDAO(owner)
    dao = await Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    acl = await ACL.at(await dao.acl())
    disputableBase = await DisputableApp.new()

    const APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    await acl.createPermission(owner, dao.address, APP_MANAGER_ROLE, owner, { from: owner })
  })

  beforeEach('install disputable app', async () => {
    const initializeData = disputableBase.contract.initialize.getData()
    const receipt = await dao.newAppInstance('0x1234', disputableBase.address, initializeData, false, { from: owner })
    disputable = await DisputableApp.at(getNewProxyAddress(receipt))

    const SET_AGREEMENT_ROLE = await disputable.SET_AGREEMENT_ROLE()
    await acl.createPermission(owner, disputable.address, SET_AGREEMENT_ROLE, owner, { from: owner })
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      assert.isTrue(await disputable.supportsInterface('0x01ffc9a7'), 'does not support ERC165')
    })

    it('supports IDisputable', async () => {
      assert.equal(await disputable.interfaceId(), '0xef113021')
      assert.isTrue(await disputable.supportsInterface('0xef113021'), 'does not support IDisputable')
    })

    it('does not support 0xffffffff', async () => {
      assert.isFalse(await disputable.supportsInterface('0xffffffff'), 'does support 0xffffffff')
    })
  })

  describe('setAgreement', () => {
    context('when the sender has permissions', () => {
      const from = owner

      const itSetsTheAgreementAddress = agreement => {
        it('sets the agreement', async () => {
          await disputable.setAgreement(agreement, { from })

          const currentAgreement = await disputable.getAgreement()
          assert.equal(currentAgreement, agreement, 'disputable agreement does not match')
        })

        it('emits an event', async () => {
          const receipt = await disputable.setAgreement(agreement, { from })

          assertAmountOfEvents(receipt, 'AgreementSet')
          assertEvent(receipt, 'AgreementSet', { agreement })
        })
      }

      context('when the agreement was unset', () => {
        context('when trying to set a new the agreement', () => {
          itSetsTheAgreementAddress(agreement)
        })

        context('when trying to unset the agreement', () => {
          itSetsTheAgreementAddress(ZERO_ADDRESS)
        })
      })

      context('when the agreement was already set', () => {
        beforeEach('set agreement', async () => {
          await disputable.setAgreement(agreement, { from })
        })

        context('when trying to re-set the agreement', () => {
          it('reverts', async () => {
            await assertRevert(disputable.setAgreement(agreement, { from }), 'DISPUTABLE_AGREEMENT_ALREADY_SET')
          })
        })

        context('when trying to set a new agreement', () => {
          it('reverts', async () => {
            await assertRevert(disputable.setAgreement(anotherAgreement, { from }), 'DISPUTABLE_AGREEMENT_ALREADY_SET')
          })
        })

        context('when trying to unset the agreement', () => {
          itSetsTheAgreementAddress(ZERO_ADDRESS)
        })
      })
    })

    context('when the sender does not have permissions', () => {
      const from = someone

      it('reverts', async () => {
        await assertRevert(disputable.setAgreement(agreement, { from }), 'APP_AUTH_FAILED')
      })
    })
  })

  describe('onDisputableActionChallenged', () => {
    const disputableId = 0, challengeId = 0, challenger = owner

    context('when the agreement was already set', () => {
      const agreement = someone

      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fails', async () => {
          const receipt = await disputable.onDisputableActionChallenged(disputableId, challengeId, challenger, { from })

          assertAmountOfEvents(receipt, 'DisputableChallenged')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = owner

        it('reverts', async () => {
          await assertRevert(disputable.onDisputableActionChallenged(disputableId, challengeId, challenger, { from }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
        })
      })
    })

    context('when the agreement was not set', () => {
      it('reverts', async () => {
        await assertRevert(disputable.onDisputableActionChallenged(disputableId, challengeId, challenger, { from: someone }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
      })
    })
  })

  describe('onDisputableActionAllowed', () => {
    const disputableId = 0

    context('when the agreement was already set', () => {
      const agreement = someone

      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fails', async () => {
          const receipt = await disputable.onDisputableActionAllowed(disputableId, { from })

          assertAmountOfEvents(receipt, 'DisputableAllowed')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = owner

        it('reverts', async () => {
          await assertRevert(disputable.onDisputableActionAllowed(disputableId, { from }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
        })
      })
    })

    context('when the agreement was not set', () => {
      it('reverts', async () => {
        await assertRevert(disputable.onDisputableActionAllowed(disputableId, { from: someone }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
      })
    })
  })

  describe('onDisputableActionRejected', () => {
    const disputableId = 0

    context('when the agreement was already set', () => {
      const agreement = someone

      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fails', async () => {
          const receipt = await disputable.onDisputableActionRejected(disputableId, { from })

          assertAmountOfEvents(receipt, 'DisputableRejected')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = owner

        it('reverts', async () => {
          await assertRevert(disputable.onDisputableActionRejected(disputableId, { from }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
        })
      })
    })

    context('when the agreement was not set', () => {
      it('reverts', async () => {
        await assertRevert(disputable.onDisputableActionRejected(disputableId, { from: someone }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
      })
    })
  })

  describe('onDisputableActionVoided', () => {
    const disputableId = 0

    context('when the agreement was already set', () => {
      const agreement = someone

      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fails', async () => {
          const receipt = await disputable.onDisputableActionVoided(disputableId, { from })

          assertAmountOfEvents(receipt, 'DisputableVoided')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = owner

        it('reverts', async () => {
          await assertRevert(disputable.onDisputableActionVoided(disputableId, { from }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
        })
      })
    })

    context('when the agreement was not set', () => {
      it('reverts', async () => {
        await assertRevert(disputable.onDisputableActionVoided(disputableId, { from: someone }), 'DISPUTABLE_SENDER_NOT_AGREEMENT')
      })
    })
  })
})
