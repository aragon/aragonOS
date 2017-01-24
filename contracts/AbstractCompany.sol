pragma solidity ^0.4.8;

contract AbstractCompany {
  enum EntityStatus {
    Base,
    Employee,
    Executive,
    God
  }

  enum SpecialEntityStatus {
    Shareholder,
    StockSale
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

  function isStockSale(address entity) constant public returns (bool);
  function isShareholder(address holder) constant public returns (bool);

  function getBylawType(string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy);
  function getVotingBylaw(string functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime);
  function addStatusBylaw(string functionSignature, AbstractCompany.EntityStatus statusNeeded);
  function addSpecialStatusBylaw(string functionSignature, AbstractCompany.SpecialEntityStatus statusNeeded);
  function addVotingBylaw(string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option);

  function setEntityStatusByStatus(address entity, uint8 status) public;
  function setEntityStatus(address entity, uint8 status) public;

  function countVotes(uint256 votingId, uint8 optionId) returns (uint256, uint256);
  function beginPoll(address voting, uint64 closes) public;
  function castVote(uint256 voteId, uint8 option) public;
  function setVotingExecuted(uint8 option) public;

  function addStock(address newStock, uint256 issue) public;
  function issueStock(uint8 _stock, uint256 _amount) public;
  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public;
  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting) public;

  function beginSale(address saleAddress) public;
  function transferSaleFunds(uint256 _sale) public;

  function assignStock(uint8 stockId, address holder, uint256 units);
  function removeStock(uint8 stockId, address holder, uint256 units);

  function getAccountingPeriodRemainingBudget() constant returns (uint256);
  function getAccountingPeriodCloses() constant returns (uint64);

  function addTreasure(string concept) payable public returns (bool);
  function registerIncome(string concept) payable public returns (bool);

  function setAccountingSettings(uint256 budget, uint64 periodDuration, uint256 dividendThreshold);
  function createRecurringReward(address to, uint256 amount, uint64 period, string concept);
  function removeRecurringReward(uint index);
  function issueReward(address to, uint256 amount, string concept);
  function splitIntoDividends() payable;

  event VoteExecuted(uint256 id, address votingAddress, uint8 outcome);
  event IssuedStock(address stockAddress, uint8 stockIndex, uint256 amount);
  event NewStockSale(address saleAddress, uint256 saleIndex, uint8 stockIndex);
  event EntityNewStatus(address entity, uint8 status);
  event BylawChanged(string functionSignature);

  event NewPeriod(uint newPeriod);
  event PeriodClosed(uint closedPeriod);
  event NewRecurringTransaction(uint recurringIndex);
  event RemovedRecurringTransaction(uint recurringIndex);
  event TransactionSaved(uint period, uint transactionIndex);
}
