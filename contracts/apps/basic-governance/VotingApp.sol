pragma solidity ^0.4.11;

import "../../tokens/MiniMeToken.sol";

contract IVotingApp {

}

contract VotingApp {
  enum VoteState {
    Debate,
    Voting,
    Closed,
    Executed
  }

  struct Vote {
    address voteAddress;
    uint64 voteCreatedBlock;
    uint64 voteStartsBlock;
    uint64 voteEndsBlock;
    // can be metadata uint256 minimumQuorum; // % * 10^16 (pe. 5% = 5 * 10^16)

    uint256 yays;
    uint256 nays;
    address[] governanceTokens;
    uint128[] votingWeights;
    uint256 totalQuorum;

    VoteState state;
  }

  Vote[] votes;

  function transitionStateIfChanged(uint votingId) {
    Vote vote = votes[votingId];
    if (vote.state == VoteState.Debate && getBlockNumber() >= vote.voteStartsBlock)
      transitionToVotingState(vote);
    if (vote.state == VoteState.Debate && getBlockNumber() >= vote.voteEndsBlock) {}
      transitionToClosedState(vote);
  }

  function transitionToVotingState(Vote vote) internal {
    vote.state = VoteState.Voting;
  }

  function transitionToClosedState(Vote vote) internal {
     vote.state = VoteState.Closed;
  }

  // @dev just for mocking purposes
  function getBlockNumber() internal returns (uint) {
    return block.number;
  }

  modifier transitions_state(uint votingId) {
    transitionStateIfChanged(votingId);
    _;
    transitionStateIfChanged(votingId);
  }
}
