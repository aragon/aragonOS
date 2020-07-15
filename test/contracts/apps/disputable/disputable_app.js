const { assertRevert } = require('../../../helpers/assertThrow')
const { getEventArgument } = require('../../../helpers/events')
const { getNewProxyAddress } = require('../../../helpers/events')
const { assertEvent, assertAmountOfEvents } = require('../../../helpers/assertEvent')(web3)

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const AgreementMock = artifacts.require('AgreementMock')
const DisputableApp = artifacts.require('DisputableAppMock')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

contract('DisputableApp', ([_, owner, agreement, anotherAgreement, someone]) => {
  let disputable, disputableBase, dao, acl

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
  const DISPUTABLE_INTERFACE = '0x737c65f9'
  const ERC165_INTERFACE = '0x01ffc9a7'

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
      assert.isTrue(await disputable.supportsInterface(ERC165_INTERFACE), 'does not support ERC165')

      assert.equal(await disputable.ERC165_INTERFACE(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
      assert.equal(await disputable.erc165interfaceID(), await disputable.ERC165_INTERFACE(), 'ERC165 interface ID does not match')
    })

    it('supports IDisputable', async () => {
      assert.isTrue(await disputable.supportsInterface(DISPUTABLE_INTERFACE), 'does not support IDisputable')

      assert.equal(await disputable.interfaceID(), DISPUTABLE_INTERFACE)
      assert.equal(await disputable.DISPUTABLE_INTERFACE(), await disputable.interfaceID(), 'IDisputable interface ID does not match')
    })

    it('does not support 0xffffffff', async () => {
      assert.isFalse(await disputable.supportsInterface('0xffffffff'), 'should not support 0xffffffff')
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

      context('when the agreement was not set', () => {
        context('when trying to set a new the agreement', () => {
          itSetsTheAgreementAddress(agreement)
        })

        context('when trying to unset the agreement', () => {
          it('reverts', async () => {
            await assertRevert(disputable.setAgreement(ZERO_ADDRESS, { from }), 'DISPUTABLE_AGREEMENT_STATE_INVAL')
          })
        })
      })

      context('when the agreement was already set', () => {
        beforeEach('set agreement', async () => {
          await disputable.setAgreement(agreement, { from })
        })

        context('when trying to re-set the agreement', () => {
          it('reverts', async () => {
            await assertRevert(disputable.setAgreement(agreement, { from }), 'DISPUTABLE_AGREEMENT_STATE_INVAL')
          })
        })

        context('when trying to set a new agreement', () => {
          it('reverts', async () => {
            await assertRevert(disputable.setAgreement(anotherAgreement, { from }), 'DISPUTABLE_AGREEMENT_STATE_INVAL')
          })
        })

        context('when trying to unset the agreement', () => {
          it('reverts', async () => {
            await assertRevert(disputable.setAgreement(ZERO_ADDRESS, { from }), 'DISPUTABLE_AGREEMENT_STATE_INVAL')
          })
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

  describe('newAction', () => {
    context('when the agreement is not set', () => {
      it('reverts', async () => {
        await assertRevert(disputable.newAction(0, '0x00', owner), 'DISPUTABLE_AGREEMENT_STATE_INVAL')
      })
    })

    context('when the agreement is set', () => {
      let agreement

      beforeEach('set agreement', async () => {
        agreement = await AgreementMock.new()
        await disputable.setAgreement(agreement.address, { from: owner })
      })

      it('does not revert', async () => {
        await disputable.newAction(0, '0x00', owner)
      })

      it('receives ETH when sent', async () => {
        const previousBalance = await web3.eth.getBalance(agreement.address)

        await disputable.newAction(0, '0x00', owner, { value: 1e18 })

        const currentBalance = await web3.eth.getBalance(agreement.address)
        assert.equal(currentBalance.sub(previousBalance).toString(), 1e18, 'agreement balance does not match')
      })
    })
  })

  describe('closeAction', () => {
    context('when the agreement is not set', () => {
      it('reverts', async () => {
        await assertRevert(disputable.closeAction(0), 'DISPUTABLE_AGREEMENT_STATE_INVAL')
      })
    })

    context('when the agreement is set', () => {
      beforeEach('set agreement', async () => {
        const agreement = await AgreementMock.new()
        await disputable.setAgreement(agreement.address, { from: owner })
      })

      it('does not revert', async () => {
        await disputable.closeAction(0)
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
