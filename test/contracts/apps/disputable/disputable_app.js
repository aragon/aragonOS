const { sha3 } = require('web3-utils')
const { getInstalledApp } = require('@aragon/contract-helpers-test/src/aragon-os')
const { getEventArgument, ZERO_ADDRESS } = require('@aragon/contract-helpers-test')
const { assertRevert, assertEvent, assertAmountOfEvents } = require('@aragon/contract-helpers-test/src/asserts')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')

const ERC165Mock = artifacts.require('ERC165Mock')
const AragonAppMock = artifacts.require('AragonAppMock')
const AgreementMock = artifacts.require('AgreementMock')
const DisputableApp = artifacts.require('DisputableAppMock')

const DISPUTABLE_INTERFACE = '0xf3d3bb51'
const ARAGON_APP_INTERFACE = '0x54053e6c'
const ERC165_INTERFACE = '0x01ffc9a7'

contract('DisputableApp', ([_, owner, agreement, anotherAgreement, someone]) => {
  let dao, acl, agreementMock
  let disputableBase, disputable

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

  before('deploy AgreementMock', async () => {
    agreementMock = await AgreementMock.new()
  })

  beforeEach('install disputable app', async () => {
    const initializeData = disputableBase.contract.methods.initialize().encodeABI()
    const receipt = await dao.newAppInstance('0x1234', disputableBase.address, initializeData, false, { from: owner })
    disputable = await DisputableApp.at(getInstalledApp(receipt))

    const SET_AGREEMENT_ROLE = await disputable.SET_AGREEMENT_ROLE()
    await acl.createPermission(owner, disputable.address, SET_AGREEMENT_ROLE, owner, { from: owner })
  })

  describe('supportsInterface', () => {
    it('supports ERC165', async () => {
      const erc165 = await ERC165Mock.new()
      assert.isTrue(await disputable.supportsInterface(ERC165_INTERFACE), 'does not support ERC165')

      assert.equal(await erc165.interfaceID(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
      assert.equal(await erc165.ERC165_INTERFACE(), ERC165_INTERFACE, 'ERC165 interface ID does not match')
    })

    it('supports AragonApp interface', async () => {
      const aragonApp = await AragonAppMock.new()
      assert.isTrue(await disputable.supportsInterface(ARAGON_APP_INTERFACE), 'does not support AragonApp interface')

      assert.equal(await aragonApp.interfaceID(), ARAGON_APP_INTERFACE, 'AragonApp interface ID does not match')
      assert.equal(await aragonApp.ARAGON_APP_INTERFACE(), ARAGON_APP_INTERFACE, 'AragonApp interface ID does not match')
    })

    it('supports IDisputable', async () => {
      assert.isTrue(await disputable.supportsInterface(DISPUTABLE_INTERFACE), 'does not support IDisputable')

      assert.equal(await disputable.interfaceID(), DISPUTABLE_INTERFACE, 'IDisputable interface ID does not match')
      assert.equal(await disputable.DISPUTABLE_INTERFACE(), DISPUTABLE_INTERFACE, 'IDisputable interface ID does not match')
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
          assertEvent(receipt, 'AgreementSet', { expectedArgs: { agreement  } })
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
      it('reverts', async () => {
        await assertRevert(disputable.setAgreement(agreement, { from: someone }), 'APP_AUTH_FAILED')
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
      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreementMock.address, { from: owner })
      })

      it('does not revert', async () => {
        await disputable.newAction(0, '0x00', owner)
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
        await disputable.setAgreement(agreementMock.address, { from: owner })
      })

      it('does not revert', async () => {
        await disputable.closeAction(0)
      })
    })
  })

  describe('onDisputableActionChallenged', () => {
    const disputableId = 0, challengeId = 0, challenger = owner

    context('when the agreement was already set', () => {
      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fail', async () => {
          const receipt = await disputable.onDisputableActionChallenged(disputableId, challengeId, challenger, { from })

          assertAmountOfEvents(receipt, 'DisputableChallenged')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = anotherAgreement

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
      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fail', async () => {
          const receipt = await disputable.onDisputableActionAllowed(disputableId, { from })

          assertAmountOfEvents(receipt, 'DisputableAllowed')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = anotherAgreement

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
      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fail', async () => {
          const receipt = await disputable.onDisputableActionRejected(disputableId, { from })

          assertAmountOfEvents(receipt, 'DisputableRejected')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = anotherAgreement

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
      beforeEach('set agreement', async () => {
        await disputable.setAgreement(agreement, { from: owner })
      })

      context('when the sender is the agreement', () => {
        const from = agreement

        it('does not fail', async () => {
          const receipt = await disputable.onDisputableActionVoided(disputableId, { from })

          assertAmountOfEvents(receipt, 'DisputableVoided')
        })
      })

      context('when the sender is not the agreement', () => {
        const from = anotherAgreement

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

  describe('roles', () => {
    it('computes roles properly', async () => {
      const EXPECTED_CHALLENGE_ROLE = sha3('CHALLENGE_ROLE')
      assert.equal(await disputableBase.CHALLENGE_ROLE(), EXPECTED_CHALLENGE_ROLE, 'CHALLENGE_ROLE doesn’t match')

      const EXPECTED_SET_AGREEMENT_ROLE = sha3('SET_AGREEMENT_ROLE')
      assert.equal(await disputableBase.SET_AGREEMENT_ROLE(), EXPECTED_SET_AGREEMENT_ROLE, 'SET_AGREEMENT_ROLE doesn’t match')
    })
  })
})
