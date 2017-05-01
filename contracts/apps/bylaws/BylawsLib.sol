pragma solidity ^0.4.8;

import "../old/AbstractCompany.sol";
import "../old/stocks/Stock.sol";
import "./BylawOracle.sol";

library BylawsLib {
  struct Bylaws {
    mapping (bytes4 => Bylaw) bylaws; // function signature to bylaw
  }

  event BylawChanged(string functionSignature, uint8 bylawType);

  struct Bylaw {
    StatusBylaw status;
    VotingBylaw voting;
    AddressBylaw addr;

    uint64 updated;
    address updatedBy;
  }

  struct AddressBylaw {
    address addr;
    bool isOracle;
    bool enforced;
  }

  struct StatusBylaw {
    uint8 neededStatus;
    bool isSpecialStatus;
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

  function initBylaw() internal returns (Bylaw memory) {
    return Bylaw(StatusBylaw(0,false,false), VotingBylaw(0,0,0,false,0,false), AddressBylaw(0x0,false,false), 0, 0x0); // zeroed bylaw
  }

  function keyForFunctionSignature(string functionSignature) returns (bytes4) {
    return bytes4(sha3(functionSignature));
  }

  function setStatusBylaw(Bylaws storage self, string functionSignature, uint8 statusNeeded, bool isSpecialStatus) {
    BylawsLib.Bylaw memory bylaw = initBylaw();
    bylaw.status.neededStatus = statusNeeded;
    bylaw.status.isSpecialStatus = isSpecialStatus;
    bylaw.status.enforced = true;

    addBylaw(self, functionSignature, bylaw);
  }

  function setAddressBylaw(Bylaws storage self, string functionSignature, address addr, bool isOracle) {
    BylawsLib.Bylaw memory bylaw = initBylaw();
    bylaw.addr.addr = addr;
    bylaw.addr.isOracle = isOracle;
    bylaw.addr.enforced = true;

    addBylaw(self, functionSignature, bylaw);
  }

  function setVotingBylaw(Bylaws storage self, string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option) {
    BylawsLib.Bylaw memory bylaw = initBylaw();

    if (base == 0) throw; // Dividing by 0 is not cool

    bylaw.voting.supportNeeded = support;
    bylaw.voting.supportBase = base;
    bylaw.voting.closingRelativeMajority = closingRelativeMajority;
    bylaw.voting.minimumVotingTime = minimumVotingTime;
    bylaw.voting.approveOption = option;
    bylaw.voting.enforced = true;

    addBylaw(self, functionSignature, bylaw);
  }

  function addBylaw(Bylaws storage self, string functionSignature, Bylaw memory bylaw) internal {
    addBylaw(self, keyForFunctionSignature(functionSignature), bylaw);
    BylawChanged(functionSignature, getBylawType(self, functionSignature));
  }

  function addBylaw(Bylaws storage self, bytes4 key, Bylaw memory bylaw) internal {
    self.bylaws[key] = bylaw;
    self.bylaws[key].updated = uint64(now);
    self.bylaws[key].updatedBy = msg.sender;
  }

  function getBylawType(Bylaws storage self, string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy) {
    BylawsLib.Bylaw memory b = getBylaw(self, functionSignature);
    updated = b.updated;
    updatedBy = b.updatedBy;

    if (b.voting.enforced) bylawType = 0;
    if (b.status.enforced) {
      if (b.status.isSpecialStatus) { bylawType = 2; }
      else {
        bylawType = 1;
      }
    }
    if (b.addr.enforced) {
      if (b.addr.isOracle) { bylawType = 4; }
      else {
        bylawType = 3;
      }
    }
  }

  function getBylaw(Bylaws storage self, string functionSignature) internal returns (Bylaw) {
    return getBylaw(self, keyForFunctionSignature(functionSignature));
  }

  function getBylaw(Bylaws storage self, bytes4 sig) internal returns (Bylaw storage) {
    return self.bylaws[sig];
  }

  function canPerformAction(Bylaws storage self, bytes4 sig, address sender, bytes data, uint256 value) returns (bool) {
    return canPerformAction(getBylaw(self, sig), sig, sender, data, value);
  }

  function canPerformAction(Bylaw storage b, bytes4 sig, address sender, bytes data, uint256 value) returns (bool) {
    if (b.updated == 0) {
      // not existent law, allow action only if is executive.
      b.status.neededStatus = uint8(AbstractCompany.EntityStatus.Executive);
      b.status.enforced = true;
    }

    // TODO: Support multi enforcement rules
    if (b.status.enforced) {
      if (b.status.isSpecialStatus) {
        return isSpecialStatus(sender, b.status.neededStatus);
      } else {
        return getStatus(sender) >= b.status.neededStatus;
      }
    }

    if (b.voting.enforced) {
      var (isValidVoting, votingId) = checkVoting(sender, b.voting);
      return isValidVoting;
    }

    if (b.addr.enforced) {
      if (!b.addr.isOracle) return sender == b.addr.addr;
      var (canPerform,) = BylawOracle(b.addr.addr).canPerformAction(sender, sig, data, value);
      return canPerform;
    }

    return false;
  }

  function performedAction(Bylaw storage b, bytes4 sig, address sender) {
    if (b.voting.enforced) {
      uint256 votingId = AbstractCompany(this).reverseVoting(sender);
      if (votingId == 0) return;
      AbstractCompany(this).setVotingExecuted(votingId, b.voting.approveOption);
    }
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
    uint256 votingId = AbstractCompany(this).reverseVoting(voteAddress);
    var (_voteAddress, startDate, closeDate, isExecuted,) = AbstractCompany(this).getVotingInfo(votingId);

    if (votingId == 0) return (false, 0);
    if (isExecuted) return (false, 0);
    if (closeDate - startDate < votingBylaw.minimumVotingTime) return (false, 0);

    var (v, totalCastedVotes, votingPower) = AbstractCompany(this).countVotes(votingId, votingBylaw.approveOption);

    if (v == 0 && votingBylaw.supportNeeded > 0) return (false, 0);

    uint256 totalSupport = votingPower * votingBylaw.supportNeeded;
    uint256 neededVotings = totalSupport / votingBylaw.supportBase + (totalSupport % votingBylaw.supportBase != 0 ? 1 : 0);

    if (v < neededVotings) {
      if (!votingBylaw.closingRelativeMajority) return (false, 0);

      if (now < closeDate) return (false, 0);
      totalSupport = totalCastedVotes * votingBylaw.supportNeeded;
      neededVotings = totalSupport / votingBylaw.supportBase + (totalSupport % votingBylaw.supportBase != 0 ? 1 : 0);
      if (v < neededVotings) return (false, 0);
    }

    return (true, votingId);
  }

  function countVotes(uint256 votingId, uint8 optionId) internal returns (uint256 votes, uint256 totalCastedVotes, uint256 votingPower) {
    return AbstractCompany(this).countVotes(votingId, optionId);
  }
}
