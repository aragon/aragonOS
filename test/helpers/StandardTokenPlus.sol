pragma solidity ^0.4.11;

import "zeppelin/token/StandardToken.sol";

contract ApproveAndCallFallBack {
  function receiveApproval(address from, uint256 _amount, address _token, bytes _data);
}

contract StandardTokenPlus is StandardToken {
  // Mocked initializer
  function StandardTokenPlus() {
    balances[msg.sender] = 100;
    totalSupply = 100;
  }

  function approveAndCall(address _spender, uint256 _amount, bytes _extraData) public returns (bool success) {
   if (!approve(_spender, _amount)) throw;

   ApproveAndCallFallBack(_spender).receiveApproval(
       msg.sender,
       _amount,
       this,
       _extraData
   );

   return true;
  }
}
