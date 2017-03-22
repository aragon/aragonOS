pragma solidity ^0.4.8;

import "zeppelin/token/StandardToken.sol";

contract WrappedToken is StandardToken {
  function WrappedToken(address _token) {
    parentToken = ERC20(_token);
  }

  // previous to wrap msg.sender must create an allowance for wrapper
  function wrap(uint256 wrappingAmount) {
    uint256 availableAllowance = parentToken.allowance(msg.sender, this);
    if (wrappingAmount > availableAllowance) throw;
    if (!parentToken.transferFrom(msg.sender, address(this), wrappingAmount)) throw;
    totalSupply = safeAdd(totalSupply, wrappingAmount);
    balances[msg.sender] = safeAdd(balances[msg.sender], wrappingAmount);
    Transfer(0x0, msg.sender, wrappingAmount);
  }

  function unwrap(uint amount) {
    unwrapAndTransfer(msg.sender, amount);
  }

  function unwrapAndTransfer(address receiver, uint amount) {
    // if (amount > balances[msg.sender]) throw; // Implicitely checked by safeSub(balance[msg.sender], amount)
    totalSupply = safeSub(totalSupply, amount);
    balances[msg.sender] = safeSub(balances[msg.sender], amount);
    if (!parentToken.transfer(receiver, amount)) throw;
    Transfer(msg.sender, 0x0, amount);
  }

  ERC20 public parentToken;
}
