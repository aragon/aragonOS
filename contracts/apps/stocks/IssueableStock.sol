pragma solidity ^0.4.8;

import "./Stock.sol";

contract IssueableStock is Stock {
  function issueStock(uint256 _value) onlyGoverningEntity {
    totalSupply = safeAdd(totalSupply, _value);

    if (shareholderIndex < 1) addShareholder(governingEntity);
    balances[governingEntity] = safeAdd(balances[governingEntity], _value);
    balanceDelegateVotes(0x0, governingEntity, _value);
  }

  function destroyStock(address holder, uint256 _value) onlyGoverningEntity {
    totalSupply = safeSub(totalSupply, _value);
    balances[holder] = safeSub(balances[holder], _value);
    balanceDelegateVotes(holder, 0x0, _value);
  }
}
