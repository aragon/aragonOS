pragma solidity ^0.4.8;

import "truffle/Assert.sol";
import "../contracts/votes/VotingLib.sol";
import "../contracts/stocks/VotingStock.sol";

contract VotingLibTest {
  using VotingLib for VotingLib.Votings;
  VotingLib.Votings votings;

  GovernanceToken token;

  function beforeAll() {
    token = new VotingStock(address(this));
    VotingStock(token).issueStock(100);
    token.transfer(0x1, 80);
    token.transfer(0x2, 20);
    votings.init();
  }

  function governanceTokens() internal returns (address[]) {
    address[] memory governanceTokens = new address[](1);
    governanceTokens[0] = token;
    return governanceTokens;
  }

  function testInit() {
    Assert.equal(votings.votings.length, 1, "Should avoid index 0");
  }

  function testCreateVoting() {
    uint256 votingId = votings.createVoting(0xbeef, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.equal(votings.votingIndex(0xbeef), votingId, "Should return index for address");
    Assert.equal(votings.votingAddress(1), 0xbeef, "Should return address for index");
    Assert.equal(votings.openedVotings[0], 1, "Should have opened voting");
    votings.votings[1].optionVotes[1] = 2;
  }

  function testCreateSecondVoting() {
    uint256 votingId = votings.createVoting(0xdead, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.equal(votings.votings[2].optionVotes[1], 0, "Storage is empty for new voting");
    Assert.equal(votings.votingIndex(0xdead), 2, "Should return index for address");
    Assert.equal(votings.votingAddress(2), 0xdead, "Should return address for index");
  }

  function testSimpleCastVote() {
    uint256 votingId = votings.createVoting(0xdeaf, governanceTokens(), uint64(now) + 1000, uint64(now));
    votings.castVote(votingId, 0x1, 1);

    assertVotingCount(votingId, 1, 80, 80, 100);
    Assert.isTrue(votings.hasVoted(votingId, 0x1), "Should have voted");
  }

  function testModifyVote() {
    uint256 votingId = votings.createVoting(0x2, governanceTokens(), uint64(now) + 1000, uint64(now));
    votings.castVote(votingId, 0x1, 1);
    votings.modifyVote(votingId, 0x1, 0, false);

    assertVotingCount(votingId, 1, 0, 80, 100);
    assertVotingCount(votingId, 0, 80, 80, 100);
    Assert.isTrue(votings.hasVoted(votingId, 0x1), "Should have voted");
  }

  function testRemoveVote() {
    uint256 votingId = votings.createVoting(0x3, governanceTokens(), uint64(now) + 1000, uint64(now));
    votings.castVote(votingId, 0x1, 1);
    votings.modifyVote(votingId, 0x1, 0, true);
    assertVotingCount(votingId, 1, 0, 0, 100);
    assertVotingCount(votingId, 0, 0, 0, 100);
    Assert.isFalse(votings.hasVoted(votingId, 0x1), "Should have not count as voted");
  }

  function testExecuteVoting() {
    uint256 votingId = votings.createVoting(0x4, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.isTrue(votings.canVote(0x1, votingId), "Should allow voting");
    votings.closeExecutedVoting(votingId, 1);
    bool isClosed;
    bool isExecuted;
    uint8 executed;

    address va;
    uint64 sd;
    uint64 ed;
    (va,sd,ed, isExecuted, executed, isClosed) = votings.getVotingInfo(votingId);
    Assert.isTrue(isClosed, "Should be closed");
    Assert.isTrue(isExecuted, "Should be executed");
    Assert.equal(uint256(executed), 1, "Should have executed option");
    Assert.isFalse(votings.canVote(0x1, votingId), "Shouldnt allow voting");
  }

  function assertVotingCount(uint256 votingId, uint8 option, uint256 _votes, uint256 _totalCastedVotes, uint256 _totalVotingPower) {
    uint256 votes;
    uint256 totalCastedVotes;
    uint256 totalVotingPower;
    (votes, totalCastedVotes, totalVotingPower) = votings.countVotes(votingId, option);
    Assert.equal(votes, _votes, "Should have correct votes");
    Assert.equal(totalCastedVotes, _totalCastedVotes, "Should have correct casted votes");
    Assert.equal(totalVotingPower, _totalVotingPower, "Should have correct voting power");
  }
}
