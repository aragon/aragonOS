pragma solidity ^0.4.8;

import "./Stock.sol";

contract IssueableStock is Stock {
  function issueStock(uint256 _value) onlyCompany {
    totalSupply = safeAdd(totalSupply, _value);
    balances[company] = safeAdd(balances[company], _value);
    addShareholder(company);
  }

  function destroyStock(address holder, uint256 _value) onlyCompany {
    totalSupply = safeSub(totalSupply, _value);
    balances[holder] = safeSub(balances[holder], _value);
  }
}
