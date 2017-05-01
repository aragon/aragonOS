pragma solidity ^0.4.8;

import "./IssueableStock.sol";

contract VotingStock is IssueableStock {
  function VotingStock(address _company)
           GovernanceToken(_company) {
    votingPower = 1;
    economicRights = 1;
    name = "Voting Stock";
    symbol = "CVS";
  }
}
