pragma solidity ^0.4.8;

import "./Voting.sol";
import "../ICompany.sol";

contract BinaryVoting is Voting {
  enum VotingOption {
    Favor,
    Against
  }

  function BinaryVoting(string favor, string against) {
    addOption(uint8(VotingOption.Favor), favor);
    addOption(uint8(VotingOption.Against), against);
    lockVoting();
  }

  function executeOnAction(uint8 option, ICompany company) {
    if (option == uint8(VotingOption.Favor)) return executeOnAppove(company);
    // if (option == uint8(VotingOption.Against)) return executeOnReject(company);
  }

  function mainSignature() public constant returns (bytes4) {
    return 0x0;
  }

  function executeOnAppove(ICompany company) internal;
}
