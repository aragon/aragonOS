pragma solidity ^0.4.8;

import "../AbstractCompany.sol";
import "../stocks/Stock.sol";

library BylawsLib {
  struct Bylaws {
    mapping (bytes4 => Bylaw) bylaws; // function signature to bylaw
  }

  struct Bylaw {
    StatusBylaw status;
    SpecialStatusBylaw specialStatus;
    VotingBylaw voting;

    uint64 updated;
    address updatedBy;
  }

  struct StatusBylaw {
    uint8 neededStatus;
    bool enforced;
  }

  struct SpecialStatusBylaw {
    uint8 neededStatus;
    bool enforced;
  }

  struct VotingBylaw {
    uint256 supportNeeded;
    uint256 supportBase;
    uint8 approveOption;

    bool closingRelativeMajority; // When voting date is finished
    uint64 minimumVotingTime;

    bool enforced;
  }

  function init() internal returns (Bylaw memory) {
    return Bylaw(StatusBylaw(0,false), SpecialStatusBylaw(0,false), VotingBylaw(0,0,0,false,0,false), 0, 0x0); // zeroed bylaw
  }

  function keyForFunctionSignature(string functionSignature) returns (bytes4) {
    return bytes4(sha3(functionSignature));
  }

  function addBylaw(Bylaws storage self, string functionSignature, Bylaw memory bylaw) internal {
    bytes4 key = keyForFunctionSignature(functionSignature);
    self.bylaws[key] = bylaw;
    self.bylaws[key].updated = uint64(now);
    self.bylaws[key].updatedBy = msg.sender;
  }

  function getBylaw(Bylaws storage self, string functionSignature) internal returns (Bylaw) {
    return self.bylaws[keyForFunctionSignature(functionSignature)];
  }

  function canPerformAction(Bylaws storage self, bytes4 sig) internal returns (bool) {
    Bylaw b = self.bylaws[sig];
    if (b.updated == 0) {
      // not existent law, allow action only if is executive
      b.status.neededStatus = uint8(AbstractCompany.EntityStatus.Executive);
      b.status.enforced = true;
    }

    // TODO: Support multi enforcement rules

    if (b.status.enforced) {
      return getStatus(msg.sender) >= b.status.neededStatus;
    }

    if (b.specialStatus.enforced) {
      return isSpecialStatus(msg.sender, b.specialStatus.neededStatus);
    }

    if (b.voting.enforced) {
      if (checkVoting(msg.sender, b.voting)) {
        // TODO: Set voting executed here to block reentry
        return true;
      }
    }

    return false;
  }

  function getStatus(address entity) internal returns (uint8) {
    return AbstractCompany(this).entityStatus(msg.sender);
  }

  function isSpecialStatus(address entity, uint8 neededStatus) internal returns (bool) {
    AbstractCompany.SpecialEntityStatus status = AbstractCompany.SpecialEntityStatus(neededStatus);

    if (status == AbstractCompany.SpecialEntityStatus.Shareholder) {
      return AbstractCompany(this).isShareholder(entity);
    }

    if (status == AbstractCompany.SpecialEntityStatus.StockSale) {
      return AbstractCompany(this).isStockSale(entity);
    }
  }

  function checkVoting(address voteAddress, VotingBylaw votingBylaw) internal returns (bool) {
    uint256 votingId = AbstractCompany(this).reverseVotings(voteAddress);

    if (votingId == 0) return false;
    if (AbstractCompany(this).voteExecuted(votingId) > 0) return false;

    var (v, totalCastedVotes, votingPower) = countVotes(votingId, votingBylaw.approveOption);
    uint256 neededVotings = votingPower * votingBylaw.supportNeeded / votingBylaw.supportBase;

    // Test this logic
    if (v < neededVotings) {
      if (!votingBylaw.closingRelativeMajority) return false;
      // TODO: Check minimum closing date!!!
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
