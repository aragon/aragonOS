pragma solidity ^0.4.8;

import "./Voting.sol";
import "../AbstractCompany.sol";

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

  function executeOnAction(uint8 option, AbstractCompany company) {
    if (option == uint8(VotingOption.Favor)) return executeOnAppove(company);
    if (option == uint8(VotingOption.Against)) return executeOnReject(company);
  }

  function executeOnReject(AbstractCompany company) internal {
    // TODO: Does anything need to happen here related to relative majority?
    var (neededSupport, supportBase,) = votingSupport(address(company));

    var (_support, _base) = company.countVotes(company.reverseVotings(this), uint8(VotingOption.Against));
    uint256 mult = 10000000000;
    if (_support * mult / _base < neededSupport * mult / supportBase) throw;

    company.setVotingExecuted(uint8(VotingOption.Against));
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.setVotingExecuted(uint8(VotingOption.Favor));
  }

  function mainSignature() public constant returns (bytes4) {
    return 0x0;
  }
}
