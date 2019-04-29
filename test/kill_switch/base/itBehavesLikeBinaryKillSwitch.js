const { assertRevert } = require('../../helpers/assertThrow')

module.exports = function (owner, address) {
  describe('isContractIgnored', function () {
    context('when the contract is not ignored', function () {
      it('returns false', async function () {
        assert.isFalse(await this.killSwitch.isContractIgnored(address))
      })
    })

    context('when the contract is ignored', function () {
      beforeEach('ignore contract', async function () {
        await this.killSwitch.setContractIgnore(address, true, { from: owner })
      })

      it('returns true', async function () {
        assert.isTrue(await this.killSwitch.isContractIgnored(address))
      })
    })
  })

  describe('setContractIgnore', function () {
    context('when the sender is the owner', function () {
      const from = owner

      context('ignoring a contract', function () {
        it('ignores the contract', async function () {
          await this.killSwitch.setContractIgnore(address, true, { from })

          assert.isTrue(await this.killSwitch.isContractIgnored(address))
        })
      })

      context('reverting a contract ignore', function () {
        it('reverts the contract ignore', async function () {
          await this.killSwitch.setContractIgnore(address, true, { from })
          await this.killSwitch.setContractIgnore(address, false, { from })

          assert.isFalse(await this.killSwitch.isContractIgnored(address))
        })
      })
    })

    context('when the sender is not the owner', function () {
      it('reverts', async function () {
        await assertRevert(this.killSwitch.setContractIgnore(address, true))
      })
    })
  })
}
