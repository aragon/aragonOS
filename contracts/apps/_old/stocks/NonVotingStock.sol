pragma solidity ^0.4.8;

import "./IssueableStock.sol";

contract NonVotingStock is IssueableStock {
  function NonVotingStock(address _company)
           GovernanceToken(_company) {
    votingPower = 0;
    economicRights = 1;
    name = "Non-Voting Stock";
    symbol = "CNS";
  }
}
