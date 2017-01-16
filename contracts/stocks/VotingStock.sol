pragma solidity ^0.4.8;

import "./GrantableStock.sol";
import "./IssueableStock.sol";

contract VotingStock is IssueableStock, GrantableStock {
  function VotingStock(address _company) {
    company = _company;
    votesPerShare = 1;
    dividendsPerShare = 1;
    name = "Voting Stock";
    symbol = "CVS";
  }
}
