pragma solidity ^0.4.13;

import "zeppelin/token/StandardToken.sol";

contract ApproveAndCallFallBack {
  function receiveApproval(address from, uint256 _amount, address _token, bytes _data);
}

contract StandardTokenPlus is StandardToken {
  // Mocked initializer
  function StandardTokenPlus() {
    balances[msg.sender] = 100;
    supply = 100;
  }

  uint256 supply;
  function totalSupply() constant public returns (uint) {
    return supply;
  }

  function approveAndCall(address _spender, uint256 _amount, bytes _extraData) public returns (bool success) {
   require(approve(_spender, _amount));

   ApproveAndCallFallBack(_spender).receiveApproval(
       msg.sender,
       _amount,
       this,
       _extraData
   );

   return true;
  }
}
