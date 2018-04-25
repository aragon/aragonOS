pragma solidity ^0.4.11;


import '../../contracts/lib/zeppelin/token/StandardToken.sol';


// mock class using StandardToken
contract StandardTokenMock is StandardToken {

  function StandardTokenMock(address initialAccount, uint256 initialBalance) public {
    balances[initialAccount] = initialBalance;
    totalSupply_ = initialBalance;
  }

}
