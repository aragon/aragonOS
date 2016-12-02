pragma solidity ^0.4.6;

import "./Stock.sol";

contract GrantableStock is Stock {
  struct StockGrant {
    uint256 value;
    uint64 cliff;
    uint64 vesting;
  }

  mapping (address => mapping (uint256 => StockGrant)) grants;
  mapping (address => uint256) private grantsIndex;

  function grantStock(address _to, uint256 _value, uint64 _cliff, uint64 _vesting) onlyCompany {
    transfer(_to, _value);
  }

  function transferrableShares(address holder) constant returns (uint256) {
    uint256 nonVestedShares = 0;
    return balances[holder] - nonVestedShares;
  }

  function transfer(address _to, uint _value) {
    if (msg.sender == company)
      super.transfer(_to, _value);
  }
}
