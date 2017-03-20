pragma solidity ^0.4.8;

import "zeppelin/token/VestedToken.sol";
import "./GovernanceToken.sol";

// transferrableTokens is called from vested to governance
contract Stock is GovernanceToken, VestedToken {}

/*
contract OldStock is BasicToken, Shareholders, PullPayment {
  address public company;
  string public name;
  string public symbol;
  uint8 public votingPower;
  uint8 public economicRights;

  mapping (uint256 => uint64) public pollingUntil; // proposal -> close timestamp
  mapping (uint256 => mapping (uint8 => uint256)) public votings; // proposal -> option -> votes
  mapping (uint256 => uint256) public totalCastedVotes;
  mapping (address => mapping (uint256 => uint256)) public voters; // voter -> proposal -> tokens

  uint256[] openedPolls;

  event NewPoll(uint256 id, uint64 closes);
  event VoteCasted(uint256 id, address voter, uint256 votes);

  modifier onlyCompany {
    if (msg.sender != company) throw;
    _;
  }

  function beginPoll(uint256 pollId, uint64 pollingCloses) onlyCompany {
    if (pollingUntil[pollId] > 0) throw; // pollId already exists
    if (pollingCloses <= now) throw; // poll cannot close in the past
    pollingUntil[pollId] = pollingCloses;
    openedPolls.push(pollId);

    NewPoll(pollId, pollingCloses);
  }

  function closePoll(uint256 pollId) onlyCompany {
    int256 i = indexOf(openedPolls, pollId);
    if (i < 0) throw;

    // Remove from array without keeping its order
    if (openedPolls.length > 1) {
      // Move last element to the place of the removing item
      openedPolls[uint256(i)] = openedPolls[openedPolls.length - 1];
    }
    // Remove last item
    openedPolls.length -= 1;
  }

  function castVoteFromCompany(address voter, uint256 pollId, uint8 vote) public onlyCompany {
    castVote(voter, pollId, vote);
  }

  function castVote(uint256 pollId, uint8 vote) public {
    castVote(msg.sender, pollId, vote);
  }

  function canVote(address voter, uint256 pollId) constant returns (bool) {
    if (now > pollingUntil[pollId]) return false; // poll is closed by date
    if (indexOf(openedPolls, pollId) < 0) return false; // poll has been executed
    if (voters[voter][pollId] >= balances[voter]) return false; // has already voted in this proposal
    if (voter == company) return false; // non assigned stock cannot vote
    if (!isShareholder[voter]) return false; // is not shareholder

    return true;
  }

  function votingPowerForPoll(address voter, uint256 pollId) constant returns (uint256) {
    uint256 remainingVotes = safeSub(balances[voter], voters[voter][pollId]);
    return safeMul(remainingVotes, votingPower);
  }

  function castVote(address voter, uint256 pollId, uint8 vote) private {
    if (!canVote(voter, pollId)) throw;

    uint256 addingVotes = votingPowerForPoll(voter, pollId);
    votings[pollId][vote] = safeAdd(votings[pollId][vote], addingVotes);
    totalCastedVotes[pollId] = safeAdd(totalCastedVotes[pollId], addingVotes);
    voters[voter][pollId] = balances[voter];

    VoteCasted(pollId, voter, addingVotes);
  }

  function totalVotingPower() constant returns (uint256) {
    return (totalSupply - balances[company]) * votingPower;
  }

  function splitDividends() payable {
    uint256 valuePerToken = msg.value / totalSupply;
    for (uint i = 0; i < shareholderIndex; i++) {
      address shareholder = shareholders[i];
      asyncSend(shareholder, balances[shareholder] * valuePerToken);
    }
  }

  // If shareholder has voted in any opened poll, it is locked
  function transferrableShares(address holder, uint64 time) constant public returns (uint256) {
    return hasShareholderVotedInOpenedPoll(holder, time) ? 0 : balances[holder];
  }

  function lastStockIsTransferrableEvent(address holder) constant public returns (uint64 lastEvent) {
    lastEvent = uint64(now);
    for (uint256 i = 0; i < openedPolls.length; i++) {
      uint256 pollId = openedPolls[i];
      if (voters[holder][pollId] > 0 && pollingUntil[pollId] > lastEvent) {
        lastEvent = pollingUntil[pollId];
      }
    }
  }

  function transferrable(address holder) constant public returns (uint256) {
    return transferrableShares(holder, uint64(now));
  }

  function hasShareholderVotedInOpenedPoll(address holder, uint64 time) constant public returns (bool) {
    for (uint256 i = 0; i < openedPolls.length; i++) {
      uint256 pollId = openedPolls[i];
      if (voters[holder][pollId] > 0 && pollingUntil[pollId] > time) return true;
    }
    return false;
  }

  function indexOf(uint256[] array, uint256 element) returns (int256) {
    for (uint256 i = 0; i < array.length; i++) {
      if (array[i] == element) return int256(i);
    }
    return -1;
  }
}
*/
