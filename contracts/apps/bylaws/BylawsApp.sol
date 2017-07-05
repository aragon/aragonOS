pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/Kernel.sol";

import "./BylawOracle.sol";
import "../Application.sol";

import "../status/StatusApp.sol";
import "../ownership/OwnershipApp.sol";
import "../capital/CapitalApp.sol";
import "../basic-governance/VotingApp.sol"; // TODO: Change for generic voting iface

contract IBylawsApp {
  event BylawChanged(bytes4 sig, uint8 bylawType, uint256 bylawId, address changedBy);
}

contract BylawsConstants {
  bytes4 constant linkBylawSig = bytes4(sha3('linkBylaw(bytes4,uint256)'));
}

contract BylawsApp is IBylawsApp, BylawsConstants, Application, PermissionsOracle {
  enum BylawType { Voting, Status, SpecialStatus, Address, Oracle, Combinator }
  enum SpecialEntityStatus { Holder, TokenSale }
  enum CombinatorType { Or, And, Xor }

  struct Bylaw {
    BylawType bylawType;

    bool not; // reverse logic

    // a bylaw can be one of these types
    uint8 status; // For status and special status types
    address addr; // For address and oracle types
    VotingBylaw voting;
    CombinatorBylaw combinator;
  }

  struct VotingBylaw {
    uint256 supportPct;       // 16pct % * 10^16 (pe. 5% = 5 * 10^16)
    uint256 minQuorumPct;     // 16pct

    uint64 minDebateTime; // in blocks
    uint64 minVotingTime; // in blocks
  }

  struct CombinatorBylaw {
    CombinatorType combinatorType; // if TRUE combinator is AND, if false is an OR combinator
    uint256 leftBylawId;
    uint256 rightBylawId;
  }

  Bylaw[] bylaws;
  mapping (bytes4 => uint) public bylawEntrypoint;

  uint constant pctBase = 10 ** 18;

  function BylawsApp(address dao)
           Application(dao) {
    newBylaw(); // so index is 1 for first legit bylaw
  }

  function canHandlePayload(bytes payload) constant returns (bool) {
    return getSig(payload) == linkBylawSig;
  }

  function newBylaw() internal returns (uint id, Bylaw storage newBylaw) {
    id = bylaws.length;
    bylaws.length++;
    newBylaw = bylaws[id];
  }

  // @dev Links a signature entry point to a bylaw.
  // @dev It is the only function that needs to be protected as it
  // @dev a nice side effect is that multiple actions can share the same bylaw
  function linkBylaw(bytes4 sig, uint id)
           existing_bylaw(id)
           onlyDAO {

    bylawEntrypoint[sig] = id;

    BylawChanged(sig, getBylawType(id), id, getSender());
  }

  // Permissions Oracle compatibility
  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
    return canPerformAction(getSig(data), sender, data, token, value);
  }

  function canPerformAction(bytes4 sig, address sender, bytes data, address token, uint256 value) returns (bool) {
    uint bylawId = bylawEntrypoint[sig];

    // not existent bylaw, always allow action.
    if (bylawId == 0) return true;

    return canPerformAction(bylawId, sender, data, token, value);
  }

  function canPerformAction(uint bylawId, address sender, bytes data, address token, uint256 value) internal returns (bool) {
    Bylaw storage bylaw = bylaws[bylawId];
    if (bylaw.bylawType == BylawType.SpecialStatus) {
      return negateIfNeeded(isSpecialStatus(sender, bylaw.status), bylaw.not);
    }

    if (bylaw.bylawType == BylawType.Status) {
      return negateIfNeeded(getStatus(sender) >= bylaw.status, bylaw.not);
    }

    if (bylaw.bylawType == BylawType.Address) {
      return negateIfNeeded(sender == bylaw.addr, bylaw.not);
    }

    if (bylaw.bylawType == BylawType.Oracle) {
      var (canPerform,) = BylawOracle(bylaw.addr).canPerformAction(sender, data, token, value);
      return negateIfNeeded(canPerform, bylaw.not);
    }

    if (bylaw.bylawType == BylawType.Voting) {
      return negateIfNeeded(checkVoting(bylaw.voting, sender), bylaw.not);
    }

    if (bylaw.bylawType == BylawType.Combinator) {
      return negateIfNeeded(computeCombinatorBylaw(bylaw, sender, data, token, value), bylaw.not);
    }
  }

  function negateIfNeeded(bool result, bool negate) returns (bool) {
    return negate ? !result : result;
  }

  function checkVoting(VotingBylaw votingBylaw, address voteAddress) internal returns (bool) {
    return getVotingApp().isVoteApproved(voteAddress, votingBylaw.supportPct, votingBylaw.minQuorumPct, votingBylaw.minDebateTime, votingBylaw.minVotingTime);
  }

  function computeCombinatorBylaw(Bylaw storage bylaw, address sender, bytes data, address token, uint256 value) internal returns (bool) {
    bool leftResult = canPerformAction(bylaw.combinator.leftBylawId, sender, data, token, value);

    // shortcuts
    if (leftResult && bylaw.combinator.combinatorType == CombinatorType.Or) return true;
    if (!leftResult && bylaw.combinator.combinatorType == CombinatorType.And) return false;

    bool rightResult = canPerformAction(bylaw.combinator.rightBylawId, sender, data, token, value);

    if (bylaw.combinator.combinatorType == CombinatorType.Xor) {
      return (leftResult && !rightResult) || (!leftResult && rightResult);
    } else {
      return rightResult;
    }
  }

  function isSpecialStatus(address entity, uint8 neededStatus) internal returns (bool) {
    SpecialEntityStatus status = SpecialEntityStatus(neededStatus);

    if (status == SpecialEntityStatus.Holder) return getOwnershipApp().isHolder(entity);
    if (status == SpecialEntityStatus.TokenSale) return false;
  }

  function getStatus(address entity) internal returns (uint8) {
    return uint8(getStatusApp().entityStatus(entity));
  }

  function setStatusBylaw(uint8 statusNeeded, bool isSpecialStatus, bool not) {
    var (id, bylaw) = newBylaw();

    bylaw.bylawType = isSpecialStatus ? BylawType.SpecialStatus : BylawType.Status;
    bylaw.status = statusNeeded;
    bylaw.not = not;
  }

  function setAddressBylaw(address addr, bool isOracle, bool not) {
    var (id, bylaw) = newBylaw();

    bylaw.bylawType = isOracle ? BylawType.Oracle : BylawType.Address;
    bylaw.addr = addr;
    bylaw.not = not;
  }

  function setVotingBylaw(uint256 supportPct, uint256 minQuorumPct, uint64 minDebateTime, uint64 minVotingTime, bool not) {
    var (id, bylaw) = newBylaw();

    require(supportPct > 0 && supportPct <= pctBase); // dont allow weird cases

    bylaw.bylawType = BylawType.Voting;
    bylaw.voting.supportPct = supportPct;
    bylaw.voting.minQuorumPct = minQuorumPct;
    bylaw.voting.minDebateTime = minDebateTime;
    bylaw.voting.minVotingTime = minVotingTime;
    bylaw.not = not;
  }

  function setCombinatorBylaw(uint combinatorType, uint leftBylawId, uint rightBylawId, bool not)
           existing_bylaw(leftBylawId) existing_bylaw(rightBylawId) {
    var (id, bylaw) = newBylaw();

    require(leftBylawId != rightBylawId);

    bylaw.bylawType = BylawType.Combinator;
    bylaw.combinator.combinatorType = CombinatorType(combinatorType);
    bylaw.combinator.leftBylawId = leftBylawId;
    bylaw.combinator.rightBylawId = rightBylawId;
    bylaw.not = not;
  }

  modifier existing_bylaw(uint bylawId) {
    require(bylawId > 0);
    require(bylawId < bylaws.length);
    _;
  }

  function getBylawType(uint bylawId) constant returns (uint8) {
    return uint8(bylaws[bylawId].bylawType);
  }

  function getBylawNot(uint bylawId) constant returns (bool) {
    return bylaws[bylawId].not;
  }

  function getStatusBylaw(uint256 bylawId) constant returns (uint8) {
    return bylaws[bylawId].status;
  }

  function getAddressBylaw(uint256 bylawId) constant returns (address) {
    return bylaws[bylawId].addr;
  }

  function getVotingBylaw(uint256 bylawId) constant returns (uint256 supportPct, uint256 minQuorumPct, uint64 minDebateTime, uint64 minVotingTime) {
    Bylaw bylaw = bylaws[bylawId];

    supportPct = bylaw.voting.supportPct;
    minQuorumPct = bylaw.voting.minQuorumPct;
    minDebateTime = bylaw.voting.minDebateTime;
    minVotingTime = bylaw.voting.minVotingTime;
  }

  function getCombinatorBylaw(uint256 bylawId) constant returns (uint combinatorType, uint leftBylawId, uint rightBylawId) {
    Bylaw bylaw = bylaws[bylawId];

    combinatorType = uint(bylaw.combinator.combinatorType);
    leftBylawId = bylaw.combinator.leftBylawId;
    rightBylawId = bylaw.combinator.rightBylawId;
  }

  function getOwnershipApp() internal returns (OwnershipApp) {
    // gets the app address that can respond to getOrgToken
    return OwnershipApp(ApplicationOrgan(dao).getResponsiveApplicationForSignature(0xf594ba59));
  }

  function getVotingApp() internal returns (VotingApp) {
    // gets the app address that can respond to createVote
    return VotingApp(ApplicationOrgan(dao).getResponsiveApplicationForSignature(0x3ae05af2));
  }

  function getStatusApp() internal returns (StatusApp) {
    // gets the app address that can respond to setEntityStatus
    return StatusApp(ApplicationOrgan(dao).getResponsiveApplicationForSignature(0x6035fa06));
  }
}
