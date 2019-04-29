const { ACTION, SEVERITY } = require('../helpers/enums')
const { assertRevert } = require('../../helpers/assertThrow')

module.exports = function (owner, anAddress) {
  describe('isContractIgnored', function () {
    context('when the contract is checked', function () {
      it('returns false', async function () {
        assert.isFalse(await this.killSwitch.isContractIgnored(anAddress))
      })
    })

    context('when the contract is ignored', function () {
      beforeEach('ignore contract', async function () {
        await this.killSwitch.setContractAction(anAddress, ACTION.IGNORE, { from: owner })
      })

      it('returns true', async function () {
        assert.isTrue(await this.killSwitch.isContractIgnored(anAddress))
      })
    })
  })

  describe('isContractDenied', function () {
    context('when the contract is not denied', function () {
      it('returns false', async function () {
        assert.isFalse(await this.killSwitch.isContractDenied(anAddress))
      })
    })

    context('when the contract is ignored', function () {
      beforeEach('ignore contract', async function () {
        await this.killSwitch.setContractAction(anAddress, ACTION.DENY, { from: owner })
      })

      it('returns true', async function () {
        assert.isTrue(await this.killSwitch.isContractDenied(anAddress))
      })
    })
  })

  describe('setContractAction', function () {
    context('when the sender is the owner', function () {
      const from = owner

      context('when there was no action set yet', function () {
        it('sets a new action', async function () {
          await this.killSwitch.setContractAction(anAddress, ACTION.DENY, { from })

          assert.isTrue(await this.killSwitch.isContractDenied(anAddress))
        })
      })

      context('when there was an action already set', function () {
        beforeEach('deny contract', async function () {
          await this.killSwitch.setContractAction(anAddress, ACTION.DENY, { from })
          assert.isTrue(await this.killSwitch.isContractDenied(anAddress))
        })

        it('changes the contract action', async function () {
          await this.killSwitch.setContractAction(anAddress, ACTION.IGNORE, { from })

          assert.isTrue(await this.killSwitch.isContractIgnored(anAddress))
          assert.isFalse(await this.killSwitch.isContractDenied(anAddress))
        })
      })
    })

    context('when the sender is not the owner', function () {
      it('reverts', async function () {
        await assertRevert(this.killSwitch.setContractAction(anAddress, ACTION.DENY))
      })
    })
  })

  describe('isSeverityIgnored', function () {
    it('returns true for none severities', async function () {
      assert.isTrue(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.NONE))
    })

    it('returns false for all the severities', async function () {
      for (const key of Object.keys(SEVERITY).slice(1)) {
        assert.isFalse(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY[key]))
      }
    })
  })
}
