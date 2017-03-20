pragma solidity ^0.4.8;

import "truffle/Assert.sol";
import "../contracts/votes/VotingLib.sol";

import "./mocks/VotingStockMock.sol";
import "./helpers/ThrowProxy.sol";

contract VotingLibTest {
  using VotingLib for VotingLib.Votings;
  VotingLib.Votings votings;

  VotingStockMock token;

  ThrowProxy throwProxy;

  function beforeAll() {
    throwProxy = new ThrowProxy(address(this));
    token = new VotingStockMock(address(this));
    IssueableStock(token).issueStock(100);
    token.transfer(0x1, 70);
    token.transfer(0x2, 20);
    token.transfer(0x3, 10);
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

  function beforeEach() {
    throwProxy = new ThrowProxy(address(this));
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

    assertVotingCount(votingId, 1, 70, 70, 100);
    Assert.isTrue(votings.hasVoted(votingId, 0x1), "Should have voted");
  }

  function testCantVoteIfNotHolder() {
    VotingLibTest(throwProxy).throwsWhenVotingWithoutTokens();
    throwProxy.assertThrows("should have thrown when voting without tokens");
  }

  function throwsWhenVotingWithoutTokens() {
    uint256 votingId = votings.createVoting(0xdead1234, governanceTokens(), uint64(now) + 1000, uint64(now));
    votings.castVote(votingId, 0xbaaf, 1);
  }

  function testModifyVote() {
    uint256 votingId = votings.createVoting(0x2, governanceTokens(), uint64(now) + 1000, uint64(now));
    votings.castVote(votingId, 0x1, 1);
    votings.modifyVote(votingId, 0x1, 0, false);

    assertVotingCount(votingId, 1, 0, 70, 100);
    assertVotingCount(votingId, 0, 70, 70, 100);
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

  function testModifyRemovedVote() {
    uint256 votingId = votings.createVoting(0x31, governanceTokens(), uint64(now) + 1000, uint64(now));
    votings.castVote(votingId, 0x1, 1);
    votings.modifyVote(votingId, 0x1, 0, true);
    assertVotingCount(votingId, 1, 0, 0, 100);
    votings.castVote(votingId, 0x1, 0);
    assertVotingCount(votingId, 0, 70, 70, 100);
    assertVotingCount(votingId, 1, 0, 70, 100);
    Assert.isTrue(votings.hasVoted(votingId, 0x1), "Should have not count as voted");
  }

  function testExecuteVoting() {
    uint256 votingId = votings.createVoting(0x4, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.isTrue(votings.canVote(0x1, votingId), "Should allow voting");
    uint256 openedVotings = votings.openedVotings.length;
    votings.closeExecutedVoting(votingId, 1);

    bool isClosed;
    bool isExecuted;
    uint8 executed;
    address va;
    uint64 sd;
    uint64 ed;
    (va, sd, ed, isExecuted, executed, isClosed) = votings.getVotingInfo(votingId);

    Assert.isTrue(isClosed, "Should be closed");
    Assert.isTrue(isExecuted, "Should be executed");
    Assert.equal(uint256(executed), 1, "Should have executed option");
    Assert.isFalse(votings.canVote(0x1, votingId), "Shouldnt allow voting");
    Assert.equal(votings.openedVotings.length, openedVotings - 1, "Should have removed voting from opened");
  }

  function testDelegateVoting() {
    uint256 votingId = votings.createVoting(0x5, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.isTrue(votings.canVote(0x2, votingId), "Should be allowed to vote as holder");
    token.setDelegateMocked(0x2, 0x3);
    Assert.isFalse(votings.canVote(0x2, votingId), "Shouldnt allow voting after delegation");

    votings.castVote(votingId, 0x3, 1);
    assertVotingCount(votingId, 1, 30, 30, 100);

    Assert.isTrue(votings.hasVoted(votingId, 0x2), "Delegator should appear as voter");
    Assert.isTrue(votings.hasVoted(votingId, 0x3), "Delegate should appear as voter");
  }

  function testDelegateModifyVote() {
    uint256 votingId = votings.createVoting(0x6, governanceTokens(), uint64(now) + 1000, uint64(now));
    // 0x2 already delegated on 0x3 on testDelegateVoting
    votings.castVote(votingId, 0x3, 1);
    assertVotingCount(votingId, 1, 30, 30, 100);
    votings.modifyVote(votingId, 0x3, 0, false);
    assertVotingCount(votingId, 0, 30, 30, 100);
  }

  function testModifyDelegatedVote() {
    uint256 votingId = votings.createVoting(0x7, governanceTokens(), uint64(now) + 1000, uint64(now));
    // 0x2 already delegated on 0x3 on testDelegateVoting
    votings.castVote(votingId, 0x3, 1);

    assertVotingCount(votingId, 1, 30, 30, 100);

    votings.modifyVote(votingId, 0x2, 0, false);

    assertVotingCount(votingId, 0, 20, 30, 100);
    assertVotingCount(votingId, 1, 10, 30, 100);
    Assert.isFalse(votings.canVote(0x3, votingId), "Shouldnt allow voting after modification by delegator");
  }

  function testRemoveDelegatedVote() {
    uint256 votingId = votings.createVoting(0x8, governanceTokens(), uint64(now) + 1000, uint64(now));
    // 0x2 already delegated on 0x3 on testDelegateVoting
    votings.castVote(votingId, 0x3, 1);
    assertVotingCount(votingId, 1, 30, 30, 100);

    votings.modifyVote(votingId, 0x2, 0, true);

    assertVotingCount(votingId, 1, 10, 10, 100);
    Assert.isFalse(votings.hasVoted(votingId, 0x2), "Delegator shouldnt appear as voter after removing");
    Assert.isFalse(votings.canVote(0x3, votingId), "Shouldnt allow voting after modification by delegator");
  }

  function testModifyRemovedDelegatedVote() {
    uint256 votingId = votings.createVoting(0x9, governanceTokens(), uint64(now) + 1000, uint64(now));
    // 0x2 already delegated on 0x3 on testDelegateVoting
    votings.castVote(votingId, 0x3, 1);
    assertVotingCount(votingId, 1, 30, 30, 100);
    votings.modifyVote(votingId, 0x2, 0, true);
    assertVotingCount(votingId, 1, 10, 10, 100);
    votings.modifyVote(votingId, 0x2, 0, false);
    assertVotingCount(votingId, 1, 10, 30, 100);
    assertVotingCount(votingId, 0, 20, 30, 100);
    Assert.isFalse(votings.canVote(0x3, votingId), "Shouldnt allow voting after modification by delegator");
  }

  function testRemoveModifiedDelegatedVote() {
    uint256 votingId = votings.createVoting(0x10, governanceTokens(), uint64(now) + 1000, uint64(now));
    // 0x2 already delegated on 0x3 on testDelegateVoting
    votings.castVote(votingId, 0x3, 1);
    assertVotingCount(votingId, 1, 30, 30, 100);
    votings.modifyVote(votingId, 0x2, 0, false);
    assertVotingCount(votingId, 1, 10, 30, 100);
    assertVotingCount(votingId, 0, 20, 30, 100);
    votings.modifyVote(votingId, 0x2, 0, true);
    assertVotingCount(votingId, 1, 10, 10, 100);
    Assert.isFalse(votings.canVote(0x3, votingId), "Shouldnt allow voting after modification by delegator");
  }

  function testMoreDelegatedVotesAfterModification() {
    uint256 votingId = votings.createVoting(0x11, governanceTokens(), uint64(now) + 1000, uint64(now));

    votings.castVote(votingId, 0x3, 1);
    votings.modifyVote(votingId, 0x2, 0, false);

    token.setDelegateMocked(0x1, 0x3);

    votings.castVote(votingId, 0x3, 1);

    assertVotingCount(votingId, 0, 20, 100, 100);
    assertVotingCount(votingId, 1, 80, 100, 100);
  }
  // From here on, 0x3 has all votes delegated to it

  function assertVotingCount(uint256 votingId, uint8 option, uint256 _votes, uint256 _totalCastedVotes, uint256 _totalVotingPower) {
    uint256 votes;
    uint256 totalCastedVotes;
    uint256 totalVotingPower;
    (votes, totalCastedVotes, totalVotingPower) = votings.countVotes(votingId, option);

    Assert.equal(votes, _votes, "Should have correct votes");
    Assert.equal(totalCastedVotes, _totalCastedVotes, "Should have correct casted votes");
    Assert.equal(totalVotingPower, _totalVotingPower, "Should have correct voting power");
  }

  // Company method mock
  function hasVotedInOpenedVoting(address holder) constant public returns (bool) {
    return votings.hasVotedInOpenedVoting(holder);
  }
}
