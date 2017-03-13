pragma solidity ^0.4.8;

import "zeppelin-solidity/contracts/token/ERC20.sol";

library VotingLib {
  struct Voting {
    mapping (uint8 => uint256) optionVotes; // option -> totalVotes
    mapping (address => mapping (address => uint256)) voters; // voter -> governance token -> votes
    address[] governanceTokens;
    uint8[] tokenWeights;
    uint256 totalCastedVotes;
    address votingAddress;
    uint64 startTimestamp;
    uint64 closeTimestamp;
    uint8 executed;
  }

  struct Votings {
    Voting[] votings;
    mapping (address => uint256) reverseVotings;
    uint256[] openedVotings;
  }

  function init(Votings storage self) {
    self.votings.length += 1;
  }

  function createVoting(Votings storage self, address votingAddress, address[] governanceTokens, uint8[] tokenWeights, uint64 closeTimestamp, uint64 startTimestamp) {
    if (self.reverseVotings[votingAddress] > 0) throw;
    if (now > startTimestamp) throw;
    if (startTimestamp > closeTimestamp) throw;

    self.votings.length += 1;
    uint256 votingId = self.votings.length - 1;
    Voting storage voting = self.votings[votingId];

    voting.votingAddress = votingAddress;
    voting.governanceTokens = governanceTokens;
    voting.tokenWeights = tokenWeights;
    voting.startTimestamp = startTimestamp;
    voting.closeTimestamp = closeTimestamp;

    self.openedVotings.push(votingId);
    self.reverseVotings[votingAddress] = votingId;

    NewVoting(votingId, startTimestamp, closeTimestamp);
  }

  function closeVoting(Votings storage self, uint256 votingId) {
    int256 i = indexOf(self.openedVotings, votingId);
    if (i < 0) throw;

    // Remove from array without keeping its order
    if (self.openedVotings.length > 1) {
      // Move last element to the place of the removing item
      self.openedVotings[uint256(i)] = self.openedVotings[self.openedVotings.length - 1];
    }
    // Remove last item
    self.openedVotings.length -= 1;
  }

  function canVote(Votings storage self, address voter, uint256 votingId) constant returns (bool) {
    Voting voting = self.votings[votingId];
    if (now > voting.closeTimestamp) return false; // poll is closed by date
    if (voting.executed > 0) return false; // poll has been executed
    if (voter == address(this)) return false; // non assigned stock cannot vote

    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      address token = voting.governanceTokens[j];
      if (ERC20(token).balanceOf(voter) > voting.voters[msg.sender][token]) return true; // can vote using token
    }

    return false;
  }

  function indexOf(uint256[] array, uint256 element) returns (int256) {
    for (uint256 i = 0; i < array.length; i++) {
      if (array[i] == element) return int256(i);
    }
    return -1;
  }

  function castVote(Votings storage self, uint256 votingId, uint8 vote) {

  }

  function countVotes();


  event NewVoting(uint256 id, uint64 starts, uint64 closes);
  event VoteCasted(uint256 id, address voter, uint256 votes);
}
