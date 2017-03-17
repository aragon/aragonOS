pragma solidity ^0.4.8;

import "truffle/Assert.sol";
import "../contracts/votes/VotingLib.sol";
import "../contracts/stocks/VotingStock.sol";

contract VotingLibTester {
  using VotingLib for VotingLib.Votings;
  VotingLib.Votings votings;

  GovernanceToken token;

  function beforeAll() {
    token = new VotingStock(address(this));
    VotingStock(token).issueStock(100);
    token.transfer(msg.sender, 80);
    votings.init();
  }

  function governanceTokens() internal returns (address[]) {
    address[] memory governanceTokens = new address[](1);
    governanceTokens[0] = token;
  }

  function testInit() {
    Assert.equal(votings.votings.length, 1, "Should avoid index 0");
  }

  function testCreateVoting() {
    votings.createVoting(0xbeef, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.equal(votings.votingIndex(0xbeef), 1, "Should return index for address");
    Assert.equal(votings.votingAddress(1), 0xbeef, "Should return address for index");
    Assert.equal(votings.openedVotings[0], 1, "Should have opened voting");
    votings.votings[1].optionVotes[1] = 2;
  }

  function testCreateSecondVoting() {
    votings.createVoting(0xdead, governanceTokens(), uint64(now) + 1000, uint64(now));
    Assert.equal(votings.votings[2].optionVotes[1], 0, "Storage is empty for new voting");
    Assert.equal(votings.votingIndex(0xdead), 2, "Should return index for address");
    Assert.equal(votings.votingAddress(2), 0xdead, "Should return address for index");
  }
}
