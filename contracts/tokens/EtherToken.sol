pragma solidity ^0.4.11;

import "zeppelin/token/StandardToken.sol";

contract EtherToken is StandardToken {
  string public name = "Ether";
  string public symbol = "ETH";
  uint8 public decimals = 18;

  function wrap() payable {
    totalSupply = safeAdd(totalSupply, msg.value);
    balances[msg.sender] = safeAdd(balances[msg.sender], msg.value);

    Mint(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) {
    return withdraw(amount, msg.sender);
  }

  function withdraw(uint256 amount, address recipient) {
    totalSupply = safeSub(totalSupply, amount);
    balances[msg.sender] = safeSub(balances[msg.sender], amount); // will throw if less than 0

    recipient.transfer(amount);

    Burn(msg.sender, amount);
  }

  event Mint(address indexed actor, uint value);
  event Burn(address indexed actor, uint value);
}
