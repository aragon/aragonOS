'use strict';

var StandardTokenMock = artifacts.require('./helpers/StandardTokenMock.sol');

contract('StandardToken', function(accounts) {

  let token;

  beforeEach(async function() {
    token = await StandardTokenMock.new(accounts[0], 100);
  });

  it('should return the correct totalSupply after construction', async function() {
    let totalSupply = await token.totalSupply();

    assert.equal(totalSupply, 100);
  });

  it('should return the correct allowance amount after approval', async function() {
    let token = await StandardTokenMock.new();
    await token.approve(accounts[1], 100);
    let allowance = await token.allowance(accounts[0], accounts[1]);

    assert.equal(allowance, 100);
  });

  it('should return correct balances after transfer', async function() {
    let token = await StandardTokenMock.new(accounts[0], 100);
    await token.transfer(accounts[1], 100);
    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);

    let balance1 = await token.balanceOf(accounts[1]);
    assert.equal(balance1, 100);
  });

  it('should throw an error when trying to transfer more than balance', async function() {
    let token = await StandardTokenMock.new(accounts[0], 100);

    try {
        let result = await token.transfer(accounts[1], 101);
        assert.equal(result.receipt.status, 0, 'should have failed status')
    } catch (e) {
        assert.isAbove(e.message.search('revert'), -1, 'should have failed with revert')
    }
  });

  it('should return correct balances after transfering from another account', async function() {
    let token = await StandardTokenMock.new(accounts[0], 100);
    await token.approve(accounts[1], 100);
    await token.transferFrom(accounts[0], accounts[2], 100, {from: accounts[1]});

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);

    let balance1 = await token.balanceOf(accounts[2]);
    assert.equal(balance1, 100);

    let balance2 = await token.balanceOf(accounts[1]);
    assert.equal(balance2, 0);
  });

  it('should throw an error when trying to transfer more than allowed', async function() {
    await token.approve(accounts[1], 99);

    try {
        let result = await token.transferFrom(accounts[0], accounts[2], 100, {from: accounts[1]});
        assert.equal(result.receipt.status, 0, 'should have failed status')
    } catch (e) {
        assert.isAbove(e.message.search('revert'), -1, 'should have failed with revert')
    }
  });

  it('should throw an error when trying to transferFrom more than _from has', async function() {
    let balance0 = await token.balanceOf(accounts[0]);
    await token.approve(accounts[1], 99);

    try {
        let result = await token.transferFrom(accounts[0], accounts[2], balance0+1, {from: accounts[1]});
        assert.equal(result.receipt.status, 0, 'should have failed status')
    } catch (e) {
        assert.isAbove(e.message.search('revert'), -1, 'should have failed with revert')
    }
  });

  describe('validating allowance updates to spender', function() {
    let preApproved;

    it('should start with zero', async function() {
      preApproved = await token.allowance(accounts[0], accounts[1]);
      preApproved = preApproved.toNumber()
      assert.equal(preApproved, 0);
    })

    it('should increase by 50 then decrease by 10', async function() {
      await token.increaseApproval(accounts[1], 50);
      let postIncrease = await token.allowance(accounts[0], accounts[1]);
      assert.equal(preApproved + 50, postIncrease, 'postincrease should be correct');
      await token.decreaseApproval(accounts[1], 10);
      let postDecrease = await token.allowance(accounts[0], accounts[1]);
      assert.equal(postIncrease.toNumber() - 10, postDecrease, 'post decrease should be correct');
    })
  });

  it('should increase by 50 then set to 0 when decreasing by more than 50', async function() {
    await token.approve(accounts[1], 50);
    await token.decreaseApproval(accounts[1], 60);
    let postDecrease = await token.allowance(accounts[0], accounts[1]);
    assert.equal(postDecrease, 0, 'postdecrease should be 0');
});

  it('should throw an error when trying to transfer to 0x0', async function() {
    let token = await StandardTokenMock.new(accounts[0], 100);

    try {
        let result = await token.transferFrom(accounts[0], accounts[2], balance0+1, {from: accounts[1]});
        assert.equal(result.receipt.status, 0, 'should have failed status')
    } catch (e) {
        assert.isAbove(e.message.search('revert'), -1, 'should have failed with revert')
    }
  });

  it('should throw an error when trying to transferFrom to 0x0', async function() {
    let token = await StandardTokenMock.new(accounts[0], 100);
    await token.approve(accounts[1], 100);

    try {
        let result = await token.transferFrom(accounts[0], 0x0, 100, {from: accounts[1]});
        assert.equal(result.receipt.status, 0, 'should have failed status')
    } catch (e) {
        assert.isAbove(e.message.search('revert'), -1, 'should have failed with revert')
    }
  });

});
