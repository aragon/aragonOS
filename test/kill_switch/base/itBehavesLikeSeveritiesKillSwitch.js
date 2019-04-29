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
    context('when no lowest allowed severity was set yet', function () {
      it('returns false for all the severities', async function () {
        for (const key of Object.keys(SEVERITY).slice(1)) {
          assert.isFalse(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY[key]))
        }
      })
    })

    context('when a lowest allowed severity was set', function () {
      beforeEach('set a lowest allowed severity', async function () {
        await this.killSwitch.setLowestAllowedSeverity(anAddress, SEVERITY.MID, { from: owner })
      })

      context('when the given severity is lower than the one set', function () {
        it('returns true', async function () {
          assert.isTrue(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.LOW))
        })
      })

      context('when the given severity is equal to the one set', function () {
        it('returns true', async function () {
          assert.isTrue(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.MID))
        })
      })

      context('when the given severity is greater than the one set', function () {
        it('returns false', async function () {
          assert.isFalse(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.HIGH))
        })
      })
    })
  })

  describe('setLowestAllowedSeverity', function () {
    context('when the contract is the owner', function () {
      const from = owner

      context('when there was no severity set', function () {
        it('sets the lowest allowed severity', async function () {
          await this.killSwitch.setLowestAllowedSeverity(anAddress, SEVERITY.HIGH, { from })

          assert.isTrue(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.HIGH))
          assert.isFalse(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.CRITICAL))
        })
      })

      context('when there was a previous severity set', function () {
        beforeEach('set lowest  allowed severity', async function () {
          await this.killSwitch.setLowestAllowedSeverity(anAddress, SEVERITY.LOW, { from })
          assert.isTrue(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.LOW))
        })

        it('changes the lowest allowed severity', async function () {
          await this.killSwitch.setLowestAllowedSeverity(anAddress, SEVERITY.MID, { from })

          assert.isTrue(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.MID))
          assert.isFalse(await this.killSwitch.isSeverityIgnored(anAddress, SEVERITY.HIGH))
        })
      })
    })

    context('when the sender is not the owner', function () {
      it('reverts', async function () {
        await assertRevert(this.killSwitch.setLowestAllowedSeverity(anAddress, SEVERITY.MID))
      })
    })
  })
}
