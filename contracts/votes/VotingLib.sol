pragma solidity ^0.4.8;

import "zeppelin/token/ERC20.sol";
import "../stocks/GovernanceToken.sol";

library VotingLib {
  struct Voting {
    mapping (uint8 => uint256) optionVotes; // option -> totalVotes (absolute votes)
    mapping (address => uint8) votedOption; // voter -> voted option (absolute votes)
    mapping (address => mapping (address => uint256)) voters; // voter -> governance token -> tokens voted
    mapping (address => mapping (address => uint256)) overruledVotes; // delegate -> governance token -> overruledVotes (absolute votes)
    address[] governanceTokens;
    uint256 totalCastedVotes;
    address votingAddress;
    uint64 startTimestamp;
    uint64 closeTimestamp;
    uint8 executed;
    bool closed;
  }

  struct Votings {
    Voting[] votings;
    mapping (address => uint256) reverseVotings;
    uint256[] openedVotings;
  }

  function init(Votings storage self) {
    self.votings.length += 1;
  }

  function votingAddress(Votings storage self, uint256 votingId) returns (address) {
    return self.votings[votingId].votingAddress;
  }

  function createVoting(Votings storage self, address votingAddress, address[] governanceTokens, uint64 closeTimestamp, uint64 startTimestamp) returns (uint256 votingId) {
    if (self.reverseVotings[votingAddress] > 0) throw;
    if (now > startTimestamp) throw;
    if (startTimestamp > closeTimestamp) throw;

    self.votings.length += 1;
    votingId = self.votings.length - 1;
    Voting storage voting = self.votings[votingId];

    voting.votingAddress = votingAddress;
    voting.governanceTokens = governanceTokens;
    voting.startTimestamp = startTimestamp;
    voting.closeTimestamp = closeTimestamp;

    self.openedVotings.push(votingId);
    self.reverseVotings[votingAddress] = votingId;

    NewVoting(votingId, startTimestamp, closeTimestamp);
  }

  function canModifyVote(Votings storage self, address voter, uint256 votingId) constant returns (bool) {
    Voting voting = self.votings[votingId];
    if (now > voting.closeTimestamp) return false; // poll is closed by date
    if (voting.closed) return false; // poll has been executed
    if (voter == address(this)) return false; // non assigned stock cannot vote
  }

  function canVote(Votings storage self, address voter, uint256 votingId) constant returns (bool) {
    if (!canModifyVote(self, voter, votingId)) return false;

    Voting voting = self.votings[votingId];
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

  function castVote(Votings storage self, uint256 votingId, uint8 vote) returns (bool voted) {
    if (!canVote(self, msg.sender, votingId)) throw;

    Voting voting = self.votings[votingId];
    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      GovernanceToken token = GovernanceToken(voting.governanceTokens[j]);
      uint remainingVotes = token.votingPowerForDelegate(msg.sender) - voting.voters[msg.sender][token] - voting.overruledVotes[msg.sender][token];
      uint addingVotes = token.votingPower() * remainingVotes;

      voting.voters[msg.sender][token] += remainingVotes;
      voting.optionVotes[vote] += addingVotes;
      voting.totalCastedVotes += addingVotes;
      if (voting.votedOption[msg.sender] != 0 && voting.votedOption[msg.sender] != 10 + vote) throw; // cant vote different things
      voting.votedOption[msg.sender] = 10 + vote; // avoid 0

      if (addingVotes > 0) voted = true;
    }

    if (voted) VoteCasted(votingId, msg.sender);
  }

  function modifyVote(Votings storage self, uint256 votingId, uint8 vote, bool removes) {
    if (!canModifyVote(self, msg.sender, votingId)) throw;

    Voting voting = self.votings[votingId];
    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      GovernanceToken token = GovernanceToken(voting.governanceTokens[j]);
      uint senderBalance = token.balanceOf(msg.sender);
      uint remainingVotes = senderBalance - voting.voters[msg.sender][token];

      if (voting.votedOption[msg.sender] == 0) throw; // can't modify before voting
      uint8 oldOption = voting.votedOption[msg.sender] - 10;

      if (token.votingPowerForDelegate(msg.sender) == 0 && remainingVotes > 0) {
        // over-write delegate vote

        if (voting.votedOption[msg.sender] == 1) throw; // already overruled
        voting.optionVotes[oldOption] -= remainingVotes * token.votingPower();
        voting.overruledVotes[token.votingDelegate(msg.sender)][token] += remainingVotes;

        if (removes) {
          voting.votedOption[msg.sender] = 1; // overruled by removing
          voting.voters[msg.sender][token] = 0;
          voting.totalCastedVotes -= remainingVotes * token.votingPower();
        } else {
          voting.votedOption[msg.sender] = 10 + vote;
          voting.voters[msg.sender][token] = remainingVotes;
          voting.optionVotes[vote] += remainingVotes * token.votingPower();
        }
      } else {
        uint totalVotes = voting.voters[msg.sender][token] - voting.overruledVotes[msg.sender][token];
        voting.optionVotes[oldOption] -= totalVotes * token.votingPower();
        uint modifyingVotes = totalVotes * token.votingPower();
        if (removes) {
          voting.votedOption[msg.sender] = 0;
          voting.voters[msg.sender][token] -= modifyingVotes;
          voting.totalCastedVotes -= modifyingVotes;
        } else {
          voting.optionVotes[vote] += modifyingVotes;
          voting.totalCastedVotes += modifyingVotes;
          voting.votedOption[msg.sender] = 10 + vote;
        }
      }
    }
  }

  function hasVoted(Votings storage self, uint256 votingId, address voter) returns (bool) {
    Voting voting = self.votings[votingId];
    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      GovernanceToken token = GovernanceToken(voting.governanceTokens[j]);
      if (voting.votedOption[token.votingDelegate(voter)] > 0) {
        if (voting.votedOption[msg.sender] != 1) return true; // not overruled
      }
    }
    return false;
  }

  function countVotes(Votings storage self, uint256 votingId, uint8 option) returns (uint256 votes, uint256 totalCastedVotes, uint256 votingPower) {
    Voting voting = self.votings[votingId];

    totalCastedVotes = voting.totalCastedVotes;
    for (uint j = 0; j < voting.governanceTokens.length; j++) {
      votes += voting.optionVotes[option];
      GovernanceToken token = GovernanceToken(voting.governanceTokens[j]);
      votingPower += (token.totalSupply() - token.balanceOf(this)) * token.votingPower();
    }
  }

  // Company knows when it can be closed, nothing to be checked here
  function closeExecutedVoting(Votings storage self, uint256 votingId, uint8 option) {
    Voting voting = self.votings[votingId];
    voting.executed = option;
    if (!voting.closed) closeVoting(self, votingId);
  }

  function closeVoting(Votings storage self, uint256 votingId) {
    Voting voting = self.votings[votingId];
    if (voting.closed && now < voting.closeTimestamp) throw; // Not executed nor closed by time
    voting.closed = true;
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

  event NewVoting(uint256 indexed id, uint64 starts, uint64 closes);
  event VoteCasted(uint256 indexed id, address indexed voter);
}
