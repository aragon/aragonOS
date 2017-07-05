pragma solidity ^0.4.11;

import "../../tokens/MiniMeToken.sol";
import "../../kernel/organs/ApplicationOrgan.sol";
import "../ownership/OwnershipApp.sol";
import "../Application.sol";
import "../../misc/CodeHelper.sol";

import "./Vote.sol";

contract IVotingApp {
  event VoteCreated(uint voteId, address voteAddress);
  event VoteCasted(uint indexed voteId, address voter, bool isYay, uint votes);
  event VoteStateChanged(uint indexed voteId, uint oldState, uint newState);
}

contract VotingConstants {
  bytes4 constant createVoteSig = bytes4(sha3('createVote(address,uint64,uint64)'));
  bytes4 constant setValidCodeSig = bytes4(sha3('setValidVoteCode(bytes32,bool)'));
}

contract VotingApp is IVotingApp, VotingConstants, Application, CodeHelper {
  function VotingApp(address daoAddr)
           Application(daoAddr) {
    votes.length++; // index 0 is empty
  }

  // hash(bytecode) -> true/false either a particular address has approved voting code
  mapping (bytes32 => bool) public validVoteCode;

  enum VoteState {
    Debate,
    Voting,
    Closed,
    Executed
  }

  struct Vote {
    VoteState state;

    address voteCreator;
    address voteAddress;
    uint64 voteCreatedBlock;
    uint64 voteStartsBlock;
    uint64 voteEndsBlock;

    address[] governanceTokens;
    uint128[] votingWeights;
    uint256 totalQuorum;

    uint256 yays;
    uint256 nays;
    mapping (address => uint) voted; // 1 for yay, 2 for nay
  }

  uint constant pctBase = 10 ** 18;
  Vote[] votes;
  mapping (address => uint) voteForAddress;

  function createVote(address _voteAddress, uint64 _voteStartsBlock, uint64 _voteEndsBlock) onlyDAO {
    uint voteId = votes.length;
    votes.length++;

    require(getBlockNumber() <= _voteStartsBlock && _voteStartsBlock < _voteEndsBlock);
    require(isVoteCodeValid(_voteAddress));

    Vote vote = votes[voteId];
    vote.voteCreator = dao_msg.sender;
    vote.voteAddress = _voteAddress;
    vote.voteCreatedBlock = getBlockNumber();
    vote.voteStartsBlock = _voteStartsBlock;
    vote.voteEndsBlock = _voteEndsBlock;
    voteForAddress[_voteAddress] = voteId;

    VoteCreated(voteId, _voteAddress);
    transitionStateIfChanged(voteId);
  }

  function voteYay(uint voteId) {
    vote(voteId, true, getSender());
  }

  function voteYayAndClose(uint voteId) {
    voteYay(voteId);
    IVote(votes[voteId].voteAddress).execute();
    transitionStateIfChanged(voteId);
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

    VoteCasted(voteId, voter, isYay, totalStake);
  }

  function isVoteApproved(address _voteAddress, uint256 _supportPct, uint256 _minQuorumPct, uint64 _minDebateTime, uint64 _minVotingTime) constant returns (bool) {
    uint voteId = voteForAddress[_voteAddress];
    require(voteId > 0);
    Vote vote = votes[voteId];
    if (vote.state == VoteState.Debate || vote.totalQuorum == 0) return false;

    if (vote.voteStartsBlock - vote.voteCreatedBlock < _minDebateTime) return false;
    if (vote.voteEndsBlock - vote.voteStartsBlock < _minVotingTime) return false;

    if (getBlockNumber() >= vote.voteEndsBlock) {
      uint256 quorum = vote.yays + vote.nays;
      uint256 yaysQuorumPct = vote.yays * pctBase / quorum;
      uint256 quorumPct = quorum * pctBase / vote.totalQuorum;

      return yaysQuorumPct >= _supportPct && quorumPct >= _minQuorumPct;
    } else {
      uint256 yaysTotalPct = vote.yays * pctBase / vote.totalQuorum;

      return yaysTotalPct >= _supportPct;
    }
  }

  function setValidVoteCode(bytes32 _codeHash, bool _valid) onlyDAO {
    require(_codeHash > 0);
    validVoteCode[_codeHash] = _valid;
  }

  function getStatusForVoteAddress(address addr) constant returns (VoteState state, address voteCreator, address voteAddress, uint64 voteCreatedBlock, uint64 voteStartsBlock, uint64 voteEndsBlock, uint256 yays, uint256 nays, uint256 totalQuorum, bool validCode) {
    return getVoteStatus(voteForAddress[addr]);
  }

  function getVoteStatus(uint voteId) constant returns (VoteState state, address voteCreator, address voteAddress, uint64 voteCreatedBlock, uint64 voteStartsBlock, uint64 voteEndsBlock, uint256 yays, uint256 nays, uint256 totalQuorum, bool validCode) {
    Vote storage vote = votes[voteId];
    state = vote.state;
    voteCreator = vote.voteCreator;
    voteAddress = vote.voteAddress;
    voteCreatedBlock = vote.voteCreatedBlock;
    voteStartsBlock = vote.voteStartsBlock;
    voteEndsBlock = vote.voteEndsBlock;
    yays = vote.yays;
    nays = vote.nays;
    totalQuorum = vote.totalQuorum;
    validCode = isVoteCodeValid(vote.voteAddress);
  }

  function getSender() internal returns (address) {
    return msg.sender == dao ? dao_msg.sender : msg.sender;
  }

  function transitionStateIfChanged(uint voteId) {
    Vote vote = votes[voteId];

    // Multiple state transitions can happen at once
    if (vote.state == VoteState.Debate && getBlockNumber() >= vote.voteStartsBlock) {
      transitionToVotingState(vote);
      VoteStateChanged(voteId, uint(VoteState.Debate), uint(VoteState.Voting));
    }

    // when voting contract has selfdestructed is because of its successful
    bool voteWasExecuted = IVote(votes[voteId].voteAddress).wasExecuted();

    if (vote.state == VoteState.Voting && (voteWasExecuted || getBlockNumber() > vote.voteEndsBlock || vote.governanceTokens.length == 0 || vote.totalQuorum == 0)) {
      vote.state = VoteState.Closed;
      VoteStateChanged(voteId, uint(VoteState.Voting), uint(VoteState.Closed));
    }

    if (vote.state == VoteState.Closed && voteWasExecuted) {
      vote.state = VoteState.Executed;
      VoteStateChanged(voteId, uint(VoteState.Closed), uint(VoteState.Executed));
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
        vote.totalQuorum += governanceRights * (tokenSupply - MiniMeToken(tokenAddress).balanceOfAt(dao, vote.voteStartsBlock));
      }
    }

    assert(vote.votingWeights.length == vote.governanceTokens.length);
  }

  function isVoteCodeValid(address _addr) constant returns (bool) {
    return validVoteCode[hashForCode(_addr)];
  }

  function getOwnershipApp() internal returns (OwnershipApp) {
    // gets the app address that can respond to getOrgToken
    return OwnershipApp(ApplicationOrgan(dao).getResponsiveApplicationForSignature(0xf594ba59));
  }

  // @dev just for mocking purposes
  function getBlockNumber() internal returns (uint64) {
    return uint64(block.number);
  }

  // TODO: Make only handleable payloads
  function canHandlePayload(bytes payload) constant returns (bool) {
    bytes4 sig = getSig(payload);
    return
      sig == setValidCodeSig ||
      sig == createVoteSig;
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
