pragma solidity ^0.4.6;

import "./AbstractCompany.sol";

import "./stocks/Stock.sol";

import "./stocks/IssueableStock.sol";
import "./stocks/GrantableStock.sol";
import "./votes/BinaryVote.sol";

contract Company is AbstractCompany {
  mapping (uint8 => address) public stocks;
  uint8 public stockIndex;

  mapping (uint256 => address) public votes;
  mapping (address => uint256) public reverseVotes;
  mapping (uint256 => bool) public voteExecuted;
  uint256 public voteIndex;

  event Log(uint256 v);

  function Company() {
    voteIndex = 1;
  }

  modifier vote(uint8 option, uint256 support, uint256 base) {
    uint256 voteId = reverseVotes[msg.sender];

    if (voteId == 0) throw;
    if (voteExecuted[voteId]) throw;

    var (v, possibleVotes) = countVotes(voteId, option);
    uint256 neededVotes = possibleVotes * support / base;
    if (v < neededVotes) throw;

    voteExecuted[voteId] = true;
    _;
  }

  /*
  modifier onlyShareholder(uint256 withCapital, uint256 withVotes) {
  }
  */

  function countVotes(uint256 voteId, uint8 optionId) returns (uint256 votes, uint256 totalPossibleVotes) {
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock stock = Stock(stocks[i]);
      votes += stock.votes(voteId, optionId);
      totalPossibleVotes += (stock.totalSupply() - stock.balanceOf(this)) * stock.votesPerShare();
    }
  }

  function beginPoll(address vote, uint64 closes) {
    Vote v = Vote(vote);
    Log(1);

    for (uint8 i = 0; i < stockIndex; i++) {
      Stock(stocks[i]).beginPoll(voteIndex, closes);
    }

    Log(2);

    votes[voteIndex] = vote;
    reverseVotes[vote] = voteIndex;
    voteIndex += 1;
  }

  event IssuedStock(address stockAddress, uint8 stockIndex);

  function addStock(address newStock, uint256 issue) public {
    if (Stock(newStock).company() != address(this)) throw;

    stocks[stockIndex] = newStock;
    stockIndex += 1;
    IssueableStock(newStock).issueStock(issue);

    IssuedStock(newStock, stockIndex - 1);
  }

  function issueStock(uint8 _stock, uint256 _amount) public vote(uint8(BinaryVote.VoteOption.Favor), 2, 3) {
    IssueableStock(stocks[_stock]).issueStock(_amount);
    IssuedStock(stocks[_stock], _stock);
  }

  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public {
    GrantableStock(stocks[_stock]).grantStock(_recipient, _amount);
  }
}
