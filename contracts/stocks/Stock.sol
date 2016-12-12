pragma solidity ^0.4.6;

import "zeppelin-solidity/contracts/token/BasicToken.sol";
import "./Shareholders.sol";

contract Stock is BasicToken, Shareholders {
  address public company;
  string public name;
  string public symbol;
  uint8 public votesPerShare;

  mapping (uint256 => uint64) public pollingUntil;
  mapping (uint256 => mapping (uint8 => uint256)) public votings;
  mapping (address => mapping (uint256 => bool)) public voters;

  event NewPoll(uint256 id, uint64 closes);
  event VoteCasted(uint256 id, address voter, uint256 votes);

  modifier onlyCompany {
    if (msg.sender != company) throw;
    _;
  }

  function beginPoll(uint256 pollId, uint64 pollingCloses) onlyCompany {
    // if (pollingUntil[pollId] > 0) throw; // pollId already exists
    //if (pollingCloses <= now) throw; // poll cannot close in the past
    pollingUntil[pollId] = pollingCloses;

    NewPoll(pollId, pollingCloses);
  }

  function castVoteFromCompany(address voter, uint256 pollId, uint8 vote) public onlyCompany {
    castVote(voter, pollId, vote);
  }

  function castVote(uint256 pollId, uint8 vote) public {
    castVote(msg.sender, pollId, vote);
  }

  function canVote(address voter, uint256 pollId) constant returns (bool) {
    if (now > pollingUntil[pollId]) return false; // polling is closed
    if (voters[voter][pollId]) return false; // has already voted in this proposal
    if (voter == company) return false; // non assigned stock cannot vote
    if (!isShareholder[voter]) return false; // is not shareholder

    return true;
  }

  function castVote(address voter, uint256 pollId, uint8 vote) private {
    if (!canVote(voter, pollId)) throw;

    uint256 addingVotings = safeMul(balances[voter], votesPerShare);
    votings[pollId][vote] = safeAdd(votings[pollId][vote], addingVotings);
    voters[voter][pollId] = true;

    VoteCasted(pollId, voter, addingVotings);
  }
}
