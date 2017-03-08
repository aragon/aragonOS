pragma solidity ^0.4.8;

library VotingLib {
  struct Voting {
    mapping (uint8 => uint256) optionVotes;
    mapping (address => mapping (uint256 => uint256)) voters;
    uint256 totalCastedVotes;
    address votingAddress;
    uint64 pollingUntil;
    uint8 executed;
  }

  struct Votings {
    Voting[] votings;
    uint256[] openedVotings;
  }

  function countVotes();
  function castVote();
  function createVote();
}
