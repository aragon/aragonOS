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
    return getBylaw(self, keyForFunctionSignature(functionSignature));
  }

  function getBylaw(Bylaws storage self, bytes4 sig) internal returns (Bylaw) {
    return self.bylaws[sig];
  }

  function canPerformAction(Bylaws storage self, bytes4 sig, address sender) returns (bool) {
    Bylaw b = self.bylaws[sig];
    if (b.updated == 0) {
      // not existent law, allow action only if is executive
      b.status.neededStatus = uint8(AbstractCompany.EntityStatus.Executive);
      b.status.enforced = true;
    }

    // TODO: Support multi enforcement rules

    if (b.status.enforced) {
      return getStatus(sender) >= b.status.neededStatus;
    }

    if (b.specialStatus.enforced) {
      return isSpecialStatus(sender, b.specialStatus.neededStatus);
    }

    if (b.voting.enforced) {
      var (isValidVoting, votingId) = checkVoting(sender, b.voting);
      if (isValidVoting) {
        // TODO: Set voting executed here to block reentry
        AbstractCompany(this).setVotingExecuted(votingId, b.voting.approveOption);
        return true;
      }
    }

    return false;
  }

  function getStatus(address entity) internal returns (uint8) {
    return AbstractCompany(this).entityStatus(entity);
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

  function checkVoting(address voteAddress, VotingBylaw votingBylaw) internal returns (bool, uint256) {
    var (votingId, _voteAddress, startDate, closeDate, isExecuted,) = AbstractCompany(this).getVotingInfoForAddress(voteAddress);

    if (votingId == 0) return (false, 0);
    if (isExecuted) return (false, 0);
    if (closeDate - startDate < votingBylaw.minimumVotingTime) return (false, 0);

    var (v, totalCastedVotes, votingPower) = AbstractCompany(this).countVotes(votingId, votingBylaw.approveOption);
    uint256 neededVotings = votingPower * votingBylaw.supportNeeded / votingBylaw.supportBase;

    // Test this logic
    if (v < neededVotings) {
      if (!votingBylaw.closingRelativeMajority) return (false, 0);

      if (now < closeDate) return (false, 0);
      neededVotings = totalCastedVotes * votingBylaw.supportNeeded / votingBylaw.supportBase;
      if (v < neededVotings) return (false, 0);
    }

    return (true, votingId);
  }

  function countVotes(uint256 votingId, uint8 optionId) internal returns (uint256 votes, uint256 totalCastedVotes, uint256 votingPower) {
    return AbstractCompany(this).countVotes(votingId, optionId);
  }
}
