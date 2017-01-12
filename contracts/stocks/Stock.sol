pragma solidity ^0.4.6;

import "zeppelin-solidity/contracts/token/BasicToken.sol";
import "zeppelin-solidity/contracts/PullPayment.sol";
import "./Shareholders.sol";

contract Stock is BasicToken, Shareholders, PullPayment {
  address public company;
  string public name;
  string public symbol;
  uint8 public votesPerShare;
  uint8 public dividendsPerShare;

  mapping (uint256 => uint64) public pollingUntil; // proposal -> close timestamp
  mapping (uint256 => mapping (uint8 => uint256)) public votings; // proposal -> option -> votes
  mapping (address => mapping (uint256 => uint256)) public voters; // voter -> proposal -> tokens

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

  function castVoteFromCompany(address voter, uint256 pollId, uint8 vote) public onlyCompany {
    castVote(voter, pollId, vote);
  }

  /*

  // Removing because there is no way to see if vote was executed in company before allowing voting
  function castVote(uint256 pollId, uint8 vote) public {
    castVote(msg.sender, pollId, vote);
  }

  */

  function canVote(address voter, uint256 pollId) constant returns (bool) {
    if (now > pollingUntil[pollId]) return false; // polling is closed
    if (voters[voter][pollId] >= balances[voter]) return false; // has already voted in this proposal
    if (voter == company) return false; // non assigned stock cannot vote
    if (!isShareholder[voter]) return false; // is not shareholder

    return true;
  }

  function votingPowerForPoll(address voter, uint256 pollId) constant returns (uint256) {
    uint256 remainingVotes = safeSub(balances[voter], voters[voter][pollId]);
    return safeMul(remainingVotes, votesPerShare);
  }

  function castVote(address voter, uint256 pollId, uint8 vote) private {
    if (!canVote(voter, pollId)) throw;

    uint256 addingVotes = votingPowerForPoll(voter, pollId);
    votings[pollId][vote] = safeAdd(votings[pollId][vote], addingVotes);
    voters[voter][pollId] = balances[voter];

    VoteCasted(pollId, voter, addingVotes);
  }

  function splitDividends() payable {
    uint256 valuePerToken = msg.value / totalSupply;
    for (uint i = 0; i < shareholderIndex; i++) {
      address shareholder = shareholders[i];
      asyncSend(shareholder, balances[shareholder] * valuePerToken);
    }
  }
}
