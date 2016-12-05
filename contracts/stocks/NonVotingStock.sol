pragma solidity ^0.4.6;

import "./Stock.sol";
import "./IssueableStock.sol";

contract NonVotingStock is IssueableStock {
  uint8 public votesPerShare = 0;

  string public name = "Non-Voting Stock";
  string public symbol = "CNS";

  function NonVotingStock(address _company) {
    company = _company;
  }
}
