pragma solidity ^0.4.6;

import "zeppelin-solidity/contracts/token/BasicToken.sol";
import "./Shareholders.sol";

contract Stock is BasicToken, Shareholders {
  address public company;
  string public name;
  string public symbol;
  uint8 public votesPerShare;

  mapping (uint256 => uint64) pollingUntil;
  mapping (uint256 => mapping (uint8 => uint256)) votes;
  mapping (address => mapping (uint256 => bool)) voters;

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

    NewPoll(pollId, pollingCloses);
  }

  function castVote(uint256 pollId, uint8 vote) public {
    if (now > pollingUntil[pollId]) throw; // polling is closed
    if (voters[msg.sender][pollId]) throw; // has already voted in this proposal
    if (msg.sender == company) throw; // non assigned stock cannot vote

    uint256 addingVotes = safeMul(balances[msg.sender], votesPerShare);
    votes[pollId][vote] = safeAdd(votes[pollId][vote], addingVotes);
    voters[msg.sender][pollId] = true;

    VoteCasted(pollId, msg.sender, addingVotes);
  }
}
