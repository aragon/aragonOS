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

  mapping (uint256 => address) public sales;
  mapping (address => uint256) public reverseSales;
  uint256 public saleIndex;

  mapping (bytes32 => bool) usedSignatures;

  function isStockSale(address entity) constant public returns (bool);
  function isShareholder(address holder) constant public returns (bool);

  function getBylawType(string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy);
  function getVotingBylaw(bytes4 functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime);

  function addStatusBylaw(string functionSignature, AbstractCompany.EntityStatus statusNeeded);
  function addSpecialStatusBylaw(string functionSignature, AbstractCompany.SpecialEntityStatus statusNeeded);
  function addVotingBylaw(string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option);

  function setEntityStatusByStatus(address entity, uint8 status) public;
  function setEntityStatus(address entity, uint8 status) public;

  function getVotingInfoForAddress(address _votingAddress) returns (uint256 votingId, address votingAddress, uint64 startDate, uint64 closeDate, bool isExecuted, uint8 executed, bool isClosed);
  function getVotingInfoForId(uint256 _votingId) returns (uint256 votingId, address votingAddress, uint64 startDate, uint64 closeDate, bool isExecuted, uint8 executed, bool isClosed);
  function countVotes(uint256 votingIndex, uint8 optionId) returns (uint256, uint256, uint256);
  function beginUntrustedPoll(address voting, uint64 closingTime, address sender, bytes32 r, bytes32 s, uint8 v, uint nonce);
  function beginPoll(address voting, uint64 closes, bool voteOnCreate, bool executesIfDecided) public;
  function castVote(uint256 voteId, uint8 option, bool executesIfDecided) public;
  function modifyVote(uint256 votingId, uint8 option, bool removes, bool executesIfDecided) public;
  function setVotingExecuted(uint256 votingId, uint8 option) public;
  function hasVotedInOpenedVoting(address holder) constant public returns (bool);

  function addStock(address newStock, uint256 issue) public;
  function issueStock(uint8 _stock, uint256 _amount) public;
  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public;
  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _start, uint64 _cliff, uint64 _vesting) public;

  function beginSale(address saleAddress) public;
  function transferSaleFunds(uint256 _sale) public;

  function assignStock(uint8 stockId, address holder, uint256 units);
  function removeStock(uint8 stockId, address holder, uint256 units);

  function getAccountingPeriodRemainingBudget() constant returns (uint256);
  function getAccountingPeriodCloses() constant returns (uint64);

  function addTreasure(string concept) payable public returns (bool);
  // function registerIncome(string concept) payable public returns (bool);

  function setAccountingSettings(uint256 budget, uint64 periodDuration, uint256 dividendThreshold);
  function createRecurringReward(address to, uint256 amount, uint64 period, string concept);
  function removeRecurringReward(uint index);
  function issueReward(address to, uint256 amount, string concept);
  function splitIntoDividends() payable;

  event NewVoting(uint256 indexed id, address votingAddress, uint64 starts, uint64 closes);
  event VoteCasted(uint256 indexed id, address votingAddress, address indexed voter);
  event VoteExecuted(uint256 indexed id, address votingAddress, uint8 outcome);

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
