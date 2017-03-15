pragma solidity ^0.4.8;

import "./Stock.sol";

contract IssueableStock is Stock {
  function issueStock(uint256 _value) onlyGoverningEntity {
    totalSupply = safeAdd(totalSupply, _value);
    balances[governingEntity] = safeAdd(balances[governingEntity], _value);
    delegatedVotes[governingEntity] = safeAdd(delegatedVotes[governingEntity], _value);
  }

  function destroyStock(address holder, uint256 _value) onlyGoverningEntity {
    totalSupply = safeSub(totalSupply, _value);
    balances[holder] = safeSub(balances[holder], _value);
    delegatedVotes[holder] = safeSub(delegatedVotes[holder], _value);
  }
}
