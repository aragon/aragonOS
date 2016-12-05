pragma solidity ^0.4.6;

import "./GrantableStock.sol";
import "./IssueableStock.sol";

contract VotingStock is IssueableStock, GrantableStock {
  string public name = "Voting Stock";
  string public symbol = "CVS";

  uint8 public votesPerShare = 1;

  function VotingStock(address _company) {
    company = _company;
  }
}
