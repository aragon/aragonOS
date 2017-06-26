pragma solidity ^0.4.11;

import "../../tokens/MiniMeToken.sol";
import "../../kernel/organs/ApplicationOrgan.sol";
import "../ownership/OwnershipApp.sol";
import "../Application.sol";

contract IVotingApp {
  event VoteCreated(uint voteId, address voteAddress);
  event VoteStarted(uint indexed voteId);
  event VoteCasted(uint indexed voteId, address voter, bool isYay);
  event VoteClosed(uint indexed voteId);
}

contract VotingApp is IVotingApp, Application {
  function VotingApp(address daoAddr)
           Application(daoAddr) {
    votes.length++; // index 0 is empty
  }

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
    uint256 targetYayPct; // Allows to close vote before hand. % * 10^16 (pe. 5% = 5 * 10^16)

    address[] governanceTokens;
    uint128[] votingWeights;
    uint256 totalQuorum;

    uint256 yays;
    uint256 nays;
    mapping (address => uint) voted; // 1 for yay, 2 for nay

    VoteState state;
  }

  Vote[] votes;
  mapping (address => uint) voteForAddress;

  function createVote(address _voteAddress, uint64 _voteStartsBlock, uint64 _voteEndsBlock, uint256 _targetYayPct) onlyDAO {
    uint voteId = votes.length;
    votes.length++;

    require(getBlockNumber() < _voteStartsBlock && _voteStartsBlock < _voteEndsBlock);

    Vote vote = votes[voteId];
    vote.voteAddress = _voteAddress;
    vote.voteCreatedBlock = getBlockNumber();
    vote.voteStartsBlock = _voteStartsBlock;
    vote.voteEndsBlock = _voteEndsBlock;
    vote.targetYayPct = _targetYayPct;
    voteForAddress[_voteAddress] = voteId;

    VoteCreated(voteId, _voteAddress);
  }

  function voteYay(uint voteId) {
    vote(voteId, true, getSender());
  }

  function voteNay(uint voteId) {
    vote(voteId, false, getSender());
  }

  function vote(uint voteId, bool isYay, address voter)
           transitions_state(voteId) only_state(voteId, VoteState.Voting)
           internal {
    Vote storage vote = votes[voteId];
    uint tokenLength = vote.governanceTokens.length;

    uint totalStake = 0;
    for (uint i = 0; i < tokenLength; i++) {
      uint balance = MiniMeToken(vote.governanceTokens[i]).balanceOfAt(voter, vote.voteStartsBlock);
      totalStake += balance * vote.votingWeights[i];
    }

    if (vote.voted[voter] > 0) {  // already voted
      bool votedYay = vote.voted[voter] == 1;

      if (votedYay) vote.yays -= totalStake;
      else vote.nays -= totalStake;
    }

    if (isYay) vote.yays += totalStake;
    else vote.nays += totalStake;

    vote.voted[voter] = isYay ? 1 : 2;

    VoteCasted(voteId, voter, isYay);
  }

  function getSender() internal returns (address) {
    return msg.sender == dao ? dao_msg.sender : msg.sender;
  }

  function transitionStateIfChanged(uint voteId) {
    Vote vote = votes[voteId];

    // Multiple state transitions can happen at once
    if (vote.state == VoteState.Debate && getBlockNumber() >= vote.voteStartsBlock) {
      transitionToVotingState(vote);
      VoteStarted(voteId);
    }

    if (vote.state == VoteState.Voting && (vote.targetYayPct >= vote.yays || getBlockNumber() >= vote.voteEndsBlock || vote.governanceTokens.length == 0 || vote.totalQuorum == 0)) {
      vote.state = VoteState.Closed;
      VoteClosed(voteId);
    }
  }

  function transitionToVotingState(Vote storage vote) internal {
    vote.state = VoteState.Voting;
    OwnershipApp ownershipApp = getOwnershipApp();

    uint count = ownershipApp.getTokenCount();
    for (uint i = 0; i < count; i++) {
      var (tokenAddress, governanceRights,) = ownershipApp.getOrgToken(i);
      if (governanceRights > 0) {
        vote.governanceTokens.push(tokenAddress);
        vote.votingWeights.push(governanceRights);
        uint tokenSupply = MiniMeToken(tokenAddress).totalSupplyAt(vote.voteStartsBlock);
        vote.totalQuorum += governanceRights * tokenSupply;
      }
    }
    assert(vote.votingWeights.length == vote.governanceTokens.length);
  }

  function getOwnershipApp() internal returns (OwnershipApp) {
    // gets the app address that can respond to getOrgToken
    return OwnershipApp(ApplicationOrgan(dao).getResponsiveApplicationForSignature(0xf594ba59));
  }

  // @dev just for mocking purposes
  function getBlockNumber() internal returns (uint64) {
    return uint64(block.number);
  }

  modifier transitions_state(uint voteId) {
    transitionStateIfChanged(voteId);
    _;
    transitionStateIfChanged(voteId);
  }

  modifier only_state(uint voteId, VoteState state) {
    require(votes[voteId].state == state);
    _;
  }
}
