pragma solidity ^0.4.8;

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

  function countVotes();
  function castVote();

  event NewVoting(uint256 id, uint64 starts, uint64 closes);
  event VoteCasted(uint256 id, address voter, uint256 votes);
}
