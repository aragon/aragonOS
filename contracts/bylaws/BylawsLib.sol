pragma solidity ^0.4.6;

import "../AbstractCompany.sol";
import "../stocks/Stock.sol";

library BylawsLib {
  struct Bylaws {
    mapping (bytes4 => Bylaw) bylaws; // function signature to bylaw
  }

  struct Bylaw {
    StatusBylaw status;
    VotingBylaw voting;

    uint64 updated;
  }

  struct StatusBylaw {
    uint8 neededStatus;
    bool enforced;
  }

  struct VotingBylaw {
    uint256 supportNeeded;
    uint256 supportBase;
    uint8 approveOption;

    bool allowVotingBaseCount; // When voting date is finished
    bool enforced;
  }

  function canPerformAction(Bylaws storage self) internal returns (bool) {
    Bylaw b = self.bylaws[msg.sig];
    if (b.updated == 0) return false; // not existent law, not allow action

    if (b.status.enforced) {
      return getStatus(msg.sender) >= b.status.neededStatus;
    }

    if (b.voting.enforced) {
      return checkVoting(msg.sender, b.voting);
    }

    return false;
  }

  function getStatus(address entity) internal returns (uint8) {
    return AbstractCompany(this).entityStatus(msg.sender);
  }

  function checkVoting(address voteAddress, VotingBylaw votingBylaw) internal returns (bool) {
    uint256 votingId = AbstractCompany(this).reverseVotings(voteAddress);

    if (votingId == 0) return false;
    if (AbstractCompany(this).voteExecuted(votingId) > 0) return false;

    var (v, totalCastedVotes, votingPower) = countVotes(votingId, votingBylaw.approveOption);
    uint256 neededVotings = votingPower * votingBylaw.supportNeeded / votingBylaw.supportBase;

    // Test this logic
    if (v < neededVotings) {
      if (!votingBylaw.allowVotingBaseCount) return false;

      uint256 voteCloseDate = Stock(AbstractCompany(this).stocks(0)).pollingUntil(votingId);

      if (now < voteCloseDate) return false;
      neededVotings = totalCastedVotes * votingBylaw.supportNeeded / votingBylaw.supportBase;
      if (v < neededVotings) return false;
    }

    return true;
  }

  function countVotes(uint256 votingId, uint8 optionId) internal returns (uint256 votes, uint256 totalCastedVotes, uint256 votingPower) {
    for (uint8 i = 0; i < AbstractCompany(this).stockIndex(); i++) {
      Stock stock = Stock(AbstractCompany(this).stocks(i));

      votes += stock.votings(votingId, optionId);
      totalCastedVotes += stock.totalCastedVotes(votingId);
      votingPower += stock.totalVotingPower();
    }
  }
}
