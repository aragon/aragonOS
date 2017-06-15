pragma solidity ^0.4.11;

import "zeppelin/token/StandardToken.sol";

contract EtherToken is StandardToken {
  string public name = "Ether";
  string public symbol = "ETH";
  uint8 public decimals = 18;

  function wrap() payable {
    supply = safeAdd(supply, msg.value);
    balances[msg.sender] = safeAdd(balances[msg.sender], msg.value);

    Mint(msg.sender, msg.value);
  }

  function withdraw(uint256 amount, address recipient) {
    supply = safeSub(supply, amount);
    balances[msg.sender] = safeSub(balances[msg.sender], amount); // will throw if less than 0

    recipient.transfer(amount);

    Burn(msg.sender, amount);
  }

  uint256 supply;
  function totalSupply() constant public returns (uint) {
    return supply;
  }

  event Mint(address indexed actor, uint value);
  event Burn(address indexed actor, uint value);
}
