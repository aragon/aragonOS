pragma solidity ^0.4.6;

import "./AbstractCompany.sol";

import "./stocks/Stock.sol";
import "./stocks/IssueableStock.sol";
import "./stocks/GrantableStock.sol";

import "./votes/BinaryVoting.sol";

import "./sales/StockSale.sol";

contract Company is AbstractCompany {

  function Company() {
    votingIndex = 1; // Reverse index breaks when it is zero.
    saleIndex = 1;

    // Make contract deployer executive
    setStatus(msg.sender, uint8(AbstractCompany.EntityStatus.Executive));
  }

  function setEntityStatusByStatus(address entity, uint8 status) public {
    if (entityStatus[msg.sender] <= status) throw; // Cannot set same or higher status
    if (entity != msg.sender && entityStatus[entity] >= entityStatus[msg.sender]) throw; // Cannot change status of higher status

    // Exec can set and remove employees.
    // Someone with lesser or same status cannot change ones status
    setStatus(entity, status);
  }

  function setEntityStatusByVoting(address entity, uint8 status)
    vote(uint8(BinaryVoting.VotingOption.Favor), 50, 100) public {

    setStatus(entity, status);
  }

  function setStatus(address entity, uint8 status) private {
    entityStatus[entity] = status;
    EntityNewStatus(entity, status);
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

  modifier onlyShareholder {
    if (!isShareholder(msg.sender)) throw;
    _;
  }

  modifier minimumStatus(AbstractCompany.EntityStatus status) {
    if (entityStatus[msg.sender] < uint8(status)) throw;
    _;
  }

  function setVotingExecuted(uint8 option) {
    uint256 votingId = reverseVotings[msg.sender];
    if (votingId == 0) throw;
    if (voteExecuted[votingId] > 0) throw;

    voteExecuted[votingId] = 10 + option; // avoid 0

    VoteExecuted(votingId, msg.sender, option);
  }

  function countVotes(uint256 votingId, uint8 optionId) returns (uint256 votes, uint256 totalPossibleVotes) {
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock stock = Stock(stocks[i]);
      votes += stock.votings(votingId, optionId);
      totalPossibleVotes += (stock.totalSupply() - stock.balanceOf(this)) * stock.votesPerShare();
    }
  }

  function beginPoll(address voting, uint64 closes) onlyShareholder {
    Voting v = Voting(voting);
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock(stocks[i]).beginPoll(votingIndex, closes);
    }
    votings[votingIndex] = voting;
    reverseVotings[voting] = votingIndex;
    votingIndex += 1;
  }

  function castVote(uint256 voteId, uint8 option) onlyShareholder {
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock stock = Stock(stocks[i]);
      if (stock.isShareholder(msg.sender)) {
        stock.castVoteFromCompany(msg.sender, voteId, option);
      }
    }
  }

  function isShareholder(address holder) constant public returns (bool) {
    for (uint8 i = 0; i < stockIndex; i++) {
      if (Stock(stocks[i]).isShareholder(msg.sender)) {
        return true;
      }
    }
    return false;
  }

  function addStock(address newStock, uint256 issue) minimumStatus(AbstractCompany.EntityStatus.Executive) public {
    if (Stock(newStock).company() != address(this)) throw;

    if (stockIndex > 0) {
      // Don't allow for new stock types. Issueance needs to be voted
      if (issue > 0) throw;
      if (Stock(newStock).totalSupply() > 0) throw;
    } else {
      IssueableStock(newStock).issueStock(issue);
    }

    stocks[stockIndex] = newStock;
    stockIndex += 1;

    IssuedStock(newStock, stockIndex - 1, issue);
  }

  function issueStock(uint8 _stock, uint256 _amount)
    vote(uint8(BinaryVoting.VotingOption.Favor), 50, 100) public {
    IssueableStock(stocks[_stock]).issueStock(_amount);
    IssuedStock(stocks[_stock], _stock, _amount);
  }

  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting)
    vote(uint8(BinaryVoting.VotingOption.Favor), 50, 100) public {
    issueStock(_stock, _amount);
    GrantableStock(stocks[_stock]).grantVestedStock(_recipient, _amount, _cliff, _vesting);
  }

  function grantStock(uint8 _stock, uint256 _amount, address _recipient) minimumStatus(AbstractCompany.EntityStatus.Executive) public {
    GrantableStock(stocks[_stock]).grantStock(_recipient, _amount);
  }

  function beginSale(address saleAddress)
    vote(uint8(BinaryVoting.VotingOption.Favor), 50, 100) public {

    StockSale sale = StockSale(saleAddress);
    if (sale.companyAddress() != address(this)) { throw; }

    sales[saleIndex] = saleAddress;
    reverseSales[saleAddress] = saleIndex;
    saleIndex += 1;

    NewStockSale(saleAddress, saleIndex - 1, sale.stockId());
  }

  modifier onlySale {
    uint256 saleId = reverseSales[msg.sender];
    if (saleId <= 0) throw;
    _;
  }

  function assignStock(uint8 stockId, address holder, uint256 units) onlySale {
    IssueableStock(stocks[stockId]).issueStock(units);
    GrantableStock(stocks[stockId]).grantStock(holder, units);
  }

  function removeStock(uint8 stockId, address holder, uint256 units) onlySale {
    IssueableStock(stocks[stockId]).destroyStock(holder, units);
  }

  function () payable {}
}
