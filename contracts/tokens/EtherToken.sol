pragma solidity ^0.4.8;

import "zeppelin/token/StandardToken.sol";

contract EtherToken is StandardToken {
  string public name = "Ether";
  string public symbol = "ETH";
  uint8 public decimals = 18;

  function wrapEther() payable {
    totalSupply = safeAdd(totalSupply, msg.value);
    balances[msg.sender] = safeAdd(balances[msg.sender], msg.value);
  }

  function withdraw(uint256 amount, address recipient) {
    totalSupply = safeSub(totalSupply, amount);
    balances[msg.sender] = safeSub(balances[msg.sender], amount); // will throw if less than 0

    if (!recipient.send(amount)) throw;
  }
}
