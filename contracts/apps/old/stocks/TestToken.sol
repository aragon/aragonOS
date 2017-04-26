pragma solidity ^0.4.8;

import "zeppelin/token/StandardToken.sol";

contract TestToken is StandardToken {
  function TestToken() {
    totalSupply = 1000;
    balances[msg.sender] = totalSupply;
  }

  string public name = "Test Token";
  string public symbol = "TT";
}
