pragma solidity ^0.4.11;

import "../../../old_contracts/ICompany.sol";
import "./BylawOracle.sol";
import "../Application.sol";

import "../status/StatusApp.sol";
import "../capital/CapitalApp.sol";

contract BylawsApp {
  event BylawChanged(bytes4 sig, uint8 bylawType);

  enum BylawType { Voting, Status, SpecialStatus, Address, Oracle, Combinator }
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

    uint64 minimumDebateTime; // in blocks
    uint64 minimumVotingTime; // in blocks
  }

  struct CombinatorBylaw {
    CombinatorType combinatorType; // if TRUE combinator is AND, if false is an OR combinator
    uint256 leftBylawId;
    uint256 rightBylawId;
  }

  Bylaw[] bylaws;
  mapping (bytes4 => uint) bylawEntrypoint;

  uint constant pctBase = 10 ** 18;

  function BylawsApp() {
    newBylaw(); // so index is 1 for first legit bylaw
  }

  function newBylaw() internal returns (uint id, Bylaw storage newBylaw) {
    id = bylaws.length;
    bylaws.length++;
    newBylaw = bylaws[id];
  }

  function linkBylaw(bytes4 sig, uint id) {
    bylawEntrypoint[sig] = id;

    BylawChanged(sig, getBylawType(id));
  }

  function setStatusBylaw(bytes4 sig, uint8 statusNeeded, bool isSpecialStatus) {
    var (id, bylaw) = newBylaw();

    bylaw.bylawType = isSpecialStatus ? BylawType.SpecialStatus : BylawType.Status;
    bylaw.status = statusNeeded;

    linkBylaw(sig, id);
  }

  function setAddressBylaw(bytes4 sig, address addr, bool isOracle) {
    var (id, bylaw) = newBylaw();

    bylaw.bylawType = isOracle ? BylawType.Oracle : BylawType.Address;
    bylaw.addr = addr;

    linkBylaw(sig, id);
  }

  function setVotingBylaw(bytes4 sig, uint256 supportPct, uint256 minQuorumPct, uint64 minimumDebateTime, uint64 minimumVotingTime) {
    var (id, bylaw) = newBylaw();

    bylaw.bylawType = BylawType.Voting;
    bylaw.voting.supportPct = supportPct;
    bylaw.voting.minQuorumPct = minQuorumPct;
    bylaw.voting.minimumDebateTime = minimumDebateTime;
    bylaw.voting.minimumVotingTime = minimumVotingTime;

    linkBylaw(sig, id);
  }


  function getBylawType(uint bylawId) constant returns (uint8) {
    return uint8(bylaws[bylawId].bylawType);
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
      // var (canPerform,) = BylawOracle(b.addr).canPerformAction(sender, sig, data, value);
      return true; // canPerform; && !bylaw.not
    }

    if (bylaw.bylawType == BylawType.Voting) {}

    if (bylaw.bylawType == BylawType.Combinator) {
      return negateIfNeeded(computeCombinatorBylaw(bylaw, sender, data, token, value), bylaw.not);
    }
  }

  function computeCombinatorBylaw(Bylaw storage bylaw, address sender, bytes data, address token, uint256 value) internal returns (bool) {
    bool leftResult = canPerformAction(bylaw.combinator.leftBylawId, sender, data, token, value);

    // shortcuts
    if (leftResult && bylaw.combinator.combinatorType == CombinatorType.Or) return true;
    if (!leftResult && bylaw.combinator.combinatorType == CombinatorType.And) return false;

    bool rightResult = canPerformAction(bylaw.combinator.rightBylawId, sender, data, token, value);

    // For or and, this always finishes the execution
    if (!rightResult && bylaw.combinator.combinatorType == CombinatorType.Or) return false;
    if (rightResult && bylaw.combinator.combinatorType == CombinatorType.And) return true;

    // redundant as and/or where solved already
    if (bylaw.combinator.combinatorType == CombinatorType.Xor) {
      return (leftResult && !rightResult) || (!leftResult && rightResult);
    }
  }

  function negateIfNeeded(bool result, bool negate) returns (bool) {
    return negate ? !result : result;
  }

  function isSpecialStatus(address entity, uint8 neededStatus) internal returns (bool) {
    return true;
  }

  function getStatus(address entity) internal returns (uint8) {
    return 1;
  }


  /*
  function getStatus(address entity) internal returns (uint8) {
    return StatusApp(app().dao()).entityStatus(entity);
  }

  function isSpecialStatus(address entity, uint8 neededStatus) internal returns (bool) {
    CapitalApp.SpecialEntityStatus status = CapitalApp.SpecialEntityStatus(neededStatus);

    if (status == CapitalApp.SpecialEntityStatus.Shareholder) {
      return CapitalApp(app().dao()).isHolder(entity);
    }

    if (status == CapitalApp.SpecialEntityStatus.StockSale) {
      return CapitalApp(app().dao()).isTokenSale(entity);
    }
  }

  function checkVoting(address voteAddress, VotingBylaw votingBylaw) internal returns (bool, uint256) {
    uint256 votingId = ICompany(this).reverseVoting(voteAddress);
    var (_voteAddress, startDate, closeDate, isExecuted,) = ICompany(this).getVotingInfo(votingId);

    if (votingId == 0) return (false, 0);
    if (isExecuted) return (false, 0);
    if (closeDate - startDate < votingBylaw.minimumVotingTime) return (false, 0);

    var (v, totalCastedVotes, votingPower) = ICompany(this).countVotes(votingId, votingBylaw.approveOption);

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
    return ICompany(this).countVotes(votingId, optionId);
  }

  function app() constant returns (Application) {
    return Application(address(this));
  }
  */
}
