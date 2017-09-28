const { assertInvalidOpcode } = require('./helpers/assertThrow')
const Vault = artifacts.require('Vault')
const MiniMeToken = artifacts.require('MiniMeToken')

const n = '0x00';

contract('Vault app', accounts => {
  let vault, token = {}
  before(async () => {

    vault = await Vault.new()
    token = await MiniMeToken.new(n, n, 0, 'n', 0, 'n', true);
    await token.generateTokens(vault.address, 20);

  })

  it('can request allowance', async () => {
    await vault.requestAllowances([token.address], [5], {from: accounts[1]})
    assert.equal( await token.allowance(vault.address, accounts[1]), 5, 'should have set an allowance');
  })

  it('can handle overriding an allowance', async() => {
    await vault.requestAllowances([token.address], [10], {from: accounts[1]})
    assert.equal( await token.allowance(vault.address, accounts[1]), 10, 'should have set an allowance');
  })

  it('can handle requesting allowance with 0 amount', async() => {
    await vault.requestAllowances([token.address], [0], {from: accounts[2]})
    assert.equal( await token.allowance(vault.address, accounts[2]), 0, 'should have set an allowance');
  })

  it('throws when wrong arguments count is passed to request allowances', async() => {
    return assertInvalidOpcode(async () => {
        await vault.requestAllowances([token.address], [10, 20], {from: accounts[1]})
    })
  })

  it('can transfer tokens', async () => {
    await vault.transferTokens(token.address, accounts[2], 10, {from: accounts[1]});

    assert.equal(await token.balanceOf(vault.address), 10, 'should have trasfered')
    assert.equal(await token.balanceOf(accounts[2]), 10, 'should have trasnfered')
  })

  it('throws when transfering more then owned', async() => {
    return assertInvalidOpcode(async () => {
        await vault.transferTokens(token.address, accounts[2], 50);
    })
  })



  it('can handle token failures', async() => {
    await token.enableTransfers(false);
    return assertInvalidOpcode(async () => {
        await vault.requestAllowances([token.address], [10], {from: accounts[1]})
    })
  })

})
