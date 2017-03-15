pragma solidity ^0.4.8;

import "zeppelin/token/ERC20.sol";
import "../stocks/GovernanceToken.sol";

library VotingLib {
  struct Voting {
    mapping (uint8 => uint256) optionVotes; // option -> totalVotes
    mapping (address = uint8) votedOption; // voter -> voted option
    mapping (address => mapping (address => uint256)) voters; // voter -> governance token -> votes
    mapping (address => bool) removedVote;
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
      if (GovernanceToken(token).votingPowerForDelegate(voter) > voting.voters[msg.sender][token]) return true; // can vote using token
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
    if (!canVote(self, msg.sender, votingId)) throw;

    Voting voting = self.votings[votingId];
    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      GovernanceToken token = GovernanceToken(voting.governanceTokens[j]);
      uint remainingVotes = token.votingPowerForDelegate(msg.sender) - voting.voters[msg.sender][token];
      uint addingVotes = token.votingPower() * remainingVotes;

      voting.voters[msg.sender][token] += remainingVotes;
      voting.optionVotes[vote] += addingVotes;
      voting.totalCastedVotes += addingVotes;
      if (voting.votedOption[msg.sender] != 0 && voting.votedOption[msg.sender] =! 10 + vote) throw; // cant vote different thingys
      voting.votedOption[msg.sender] = 10 + vote; // avoid 0
    }
  }

  function modifyVote(Votings storage self, uint256 votingId, uint8 vote, bool removes) {
    Voting voting = self.votings[votingId];
    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      GovernanceToken token = GovernanceToken(voting.governanceTokens[j]);
      uint senderBalance = token.balanceOf(msg.sender);
      uint remainingVotes = senderBalance - voting.voters[msg.sender][token];
      if (token.votingPowerForDelegate(msg.sender) == 0 && remainingVotes > 0) {
        // over-write delegate vote
        if (voting.votedOption[msg.sender] == 0) throw; // can't modify before voting
        uint8 oldOption = voting.votedOption[msg.sender] - 10;

        voting.optionVotes[oldOption] -= remainingVotes * token.votingPower();

        if (removes) {
          voting.votedOption[msg.sender] = 0;
          voting.voters[msg.sender][token] = 0;
          voting.removedVote[msg.sender] = true;
          // over ruled voting mapping with negative for delegates
        } else {

        }
      }
      if (removes) {

      } else {

      }
    }
  }

  function countVotes();


  event NewVoting(uint256 id, uint64 starts, uint64 closes);
  event VoteCasted(uint256 id, address voter, uint256 votes);
}
