pragma solidity ^0.4.6;

contract AbstractCompany {
  enum EntityStatus {
    Base,
    Employee,
    Executive
  }
  mapping (address => uint8) public entityStatus;

  mapping (uint8 => address) public stocks;
  uint8 public stockIndex;

  mapping (uint256 => address) public votings;
  mapping (address => uint256) public reverseVotings;
  mapping (uint256 => uint8) public voteExecuted;
  uint256 public votingIndex;

  mapping (uint256 => address) public sales;
  mapping (address => uint256) public reverseSales;
  uint256 public saleIndex;

  function beginPoll(address voting, uint64 closes) public;
  function castVote(uint256 voteId, uint8 option) public;
  function setVotingExecuted(uint8 option) public;
  function countVotes(uint256 votingId, uint8 optionId) returns (uint256 votes, uint256 totalPossibleVotes);

  function addStock(address newStock, uint256 issue) public;
  function issueStock(uint8 _stock, uint256 _amount) public;
  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public;
  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting) public;

  function beginSale(address saleAddress) public;
  function transferSaleFunds(uint256 _sale) public;

  function assignStock(uint8 stockId, address holder, uint256 units);
  function removeStock(uint8 stockId, address holder, uint256 units);

  function isShareholder(address holder) constant public returns (bool);
  function setEntityStatusByStatus(address entity, uint8 status) public;
  function setEntityStatusByVoting(address entity, uint8 status) public;

  function setAccountingSettings(uint256 budget, uint64 periodDuration, uint256 dividendThreshold);
  function getAccountingPeriodRemainingBudget() constant returns (uint256);
  function getAccountingPeriodCloses() constant returns (uint64);
  function addTreasure(string concept) payable public returns (bool);
  function registerIncome(string concept) payable public returns (bool);
  function createRecurringReward(address to, uint256 amount, uint64 period, string concept);
  function issueReward(address to, uint256 amount, string concept);

  event VoteExecuted(uint256 id, address votingAddress, uint8 outcome);
  event IssuedStock(address stockAddress, uint8 stockIndex, uint256 amount);
  event NewStockSale(address saleAddress, uint256 saleIndex, uint8 stockIndex);
  event EntityNewStatus(address entity, uint8 status);
}
