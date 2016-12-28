pragma solidity ^0.4.6;

import "./Stock.sol";
import "./IssueableStock.sol";
import "./GrantableStock.sol";

contract NonVotingStock is IssueableStock, GrantableStock {
  function NonVotingStock(address _company) {
    company = _company;
    votesPerShare = 0;
    dividendsPerShare = 1;
    name = "Non-Voting Stock";
    symbol = "CNS";
  }
}
