pragma solidity ^0.4.6;

import "./AbstractCompany.sol";

import "./stocks/Stock.sol";

import "./stocks/IssueableStock.sol";
import "./stocks/GrantableStock.sol";
import "./votes/BinaryVoting.sol";

contract Company is AbstractCompany {
  mapping (uint8 => address) public stocks;
  uint8 public stockIndex;

  mapping (uint256 => address) public votings;
  mapping (address => uint256) public reverseVotings;
  mapping (uint256 => uint8) public voteExecuted;
  uint256 public votingIndex;

  function Company() {
    votingIndex = 1; // Reverse index breaks when it is zero.
  }

  modifier vote(uint8 option, uint256 support, uint256 base) {
    uint256 votingId = reverseVotings[msg.sender];

    if (votingId == 0) throw;
    if (voteExecuted[votingId] > 0) throw;

    var (v, possibleVotings) = countVotes(votingId, option);
    uint256 neededVotings = possibleVotings * support / base;
    if (v < neededVotings) throw;
    _;
  }

  event VoteExecuted(uint256 id, uint8 outcome);

  function setVotingExecuted(uint8 option) {
    uint256 votingId = reverseVotings[msg.sender];
    if (votingId == 0) throw;
    if (voteExecuted[votingId] > 0) throw;

    voteExecuted[votingId] = 10 + option; // avoid 0

    VoteExecuted(votingId, option);
  }

  /*
  modifier onlyShareholder(uint256 withCapital, uint256 withVotings) {
  }
  */

  function countVotes(uint256 votingId, uint8 optionId) returns (uint256 votes, uint256 totalPossibleVotes) {
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock stock = Stock(stocks[i]);
      votes += stock.votings(votingId, optionId);
      totalPossibleVotes += (stock.totalSupply() - stock.balanceOf(this)) * stock.votesPerShare();
    }
  }

  function beginPoll(address voting, uint64 closes) {
    Voting v = Voting(voting);
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock(stocks[i]).beginPoll(votingIndex, closes);
    }
    votings[votingIndex] = voting;
    reverseVotings[voting] = votingIndex;
    votingIndex += 1;
  }

  function castVote(uint256 voteId, uint8 option) {
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock stock = Stock(stocks[i]);
      if (stock.isShareholder(msg.sender)) {
        stock.castVoteFromCompany(msg.sender, voteId, option);
      }
    }
  }

  event IssuedStock(address stockAddress, uint8 stockIndex);

  function addStock(address newStock, uint256 issue) public {
    if (Stock(newStock).company() != address(this)) throw;

    stocks[stockIndex] = newStock;
    stockIndex += 1;
    IssueableStock(newStock).issueStock(issue);

    IssuedStock(newStock, stockIndex - 1);
  }

  function issueStock(uint8 _stock, uint256 _amount) public vote(uint8(BinaryVoting.VotingOption.Favor), 2, 3) {
    IssueableStock(stocks[_stock]).issueStock(_amount);
    IssuedStock(stocks[_stock], _stock);
  }

  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public {
    GrantableStock(stocks[_stock]).grantStock(_recipient, _amount);
  }
}
