pragma solidity ^0.4.6;

import "./Stock.sol";

contract IssueableStock is Stock {
  function issueStock(uint256 _value) onlyCompany {
    totalSupply = safeAdd(totalSupply, _value);
    balances[company] = safeAdd(balances[company], _value);
  }
}
