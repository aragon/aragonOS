pragma solidity ^0.4.6;

import "./Voting.sol";
import "../AbstractCompany.sol";

contract BinaryVoting is Voting, BinaryVotingMetadata {
  enum VotingOption {
    Favor,
    Against
  }

  function BinaryVoting(string favor, string against) {
    addOption(uint8(VotingOption.Favor), favor);
    addOption(uint8(VotingOption.Against), against);
    lockVoting();
  }

  function executeOnAction(uint8 option, AbstractCompany company) {
    if (option == 0) return executeOnAppove(company);
    if (option == 1) return executeOnReject(company);
  }

  function executeOnReject(AbstractCompany company) {
    suicide(address(company));
  }

  function executeOnAppove(AbstractCompany company);
}
