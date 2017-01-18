pragma solidity ^0.4.8;

import "./AbstractCompany.sol";
import "./accounting/AccountingLib.sol";
import "./bylaws/BylawsLib.sol";

import "./stocks/Stock.sol";
import "./stocks/IssueableStock.sol";
import "./stocks/GrantableStock.sol";

import "./votes/BinaryVoting.sol";

import "./sales/StockSale.sol";

contract Company is AbstractCompany {
  using AccountingLib for AccountingLib.AccountingLedger;
  using BylawsLib for BylawsLib.Bylaws;

  AccountingLib.AccountingLedger accounting;
  BylawsLib.Bylaws bylaws;

  function Company() payable {
    votingIndex = 1; // Reverse index breaks when it is zero.
    saleIndex = 1;

    accounting.init(1 ether, 4 weeks, 1 wei); // Init with 1 ether budget and 1 moon period
    accounting.addTreasure('Company bootstrap');

    // Make contract deployer executive
    setStatus(msg.sender, uint8(AbstractCompany.EntityStatus.God));
  }

  modifier checkBylaws {
    if (!bylaws.canPerformAction(msg.sig)) throw;
    _;
  }

  function setInitialBylaws() {
    uint8 favor = uint8(BinaryVoting.VotingOption.Favor);
    uint64 minimumVotingTime = uint64(7 days);

    addVotingBylaw("setEntityStatusByVoting(address,uint8)", 1, 2, true, minimumVotingTime, favor);
    addSpecialStatusBylaw("beginPoll(address,uint64)", AbstractCompany.SpecialEntityStatus.Shareholder);
    addSpecialStatusBylaw("castVote(uint256,uint8)", AbstractCompany.SpecialEntityStatus.Shareholder);

    addVotingBylaw("addStock(address,uint256)", 1, 2, true, minimumVotingTime, favor);
    addVotingBylaw("issueStock(uint8,uint256)", 1, 2, true, minimumVotingTime, favor);
    addStatusBylaw("grantStock(uint8,uint256,address)", AbstractCompany.EntityStatus.Executive);
    addVotingBylaw("grantVestedStock(uint8,uint256,address,uint64,uint64)", 1, 2, true, minimumVotingTime, favor);

    addVotingBylaw("beginSale(address)", 1, 2, true, minimumVotingTime, favor);
    addStatusBylaw("transferSaleFunds(uint256)", AbstractCompany.EntityStatus.Executive);

    addSpecialStatusBylaw("assignStock(uint8,address,uint256)", AbstractCompany.SpecialEntityStatus.StockSale);
    addSpecialStatusBylaw("removeStock(uint8,address,uint256)", AbstractCompany.SpecialEntityStatus.StockSale);

    addVotingBylaw("setAccountingSettings(uint256,uint64,uint256)", 1, 2, true, minimumVotingTime, favor);
    addStatusBylaw("createRecurringReward(address,uint256,uint64,string)", AbstractCompany.EntityStatus.Executive);
    addStatusBylaw("removeRecurringReward(uint)", AbstractCompany.EntityStatus.Executive);
    addStatusBylaw("issueReward(address,uint256,string)", AbstractCompany.EntityStatus.Executive);

    // Protect bylaws under a 2/3 voting
    addVotingBylaw("addStatusBylaw(string,uint8)", 2, 3, false, minimumVotingTime, favor);
    addVotingBylaw("addSpecialStatusBylaw(string,uint8)", 2, 3, false, minimumVotingTime, favor);
    addVotingBylaw("addVotingBylaw(string,uint256,uint256,bool,uint8)", 2, 3, false, minimumVotingTime, favor); // so meta
  }

  function getBylawType(string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy) {
    BylawsLib.Bylaw memory b = bylaws.getBylaw(functionSignature);
    updated = b.updated;
    updatedBy = b.updatedBy;

    if (b.voting.enforced) bylawType = 0;
    if (b.status.enforced) bylawType = 1;
    if (b.specialStatus.enforced) bylawType = 2;
  }

  function getStatusBylaw(string functionSignature) constant returns (uint8) {
    BylawsLib.Bylaw memory b = bylaws.getBylaw(functionSignature);

    if (b.status.enforced) return b.status.neededStatus;
    if (b.specialStatus.enforced) return b.specialStatus.neededStatus;
  }

  function getVotingBylaw(string functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    BylawsLib.VotingBylaw memory b = bylaws.getBylaw(functionSignature).voting;

    support = b.supportNeeded;
    base = b.supportBase;
    closingRelativeMajority = b.closingRelativeMajority;
    minimumVotingTime = b.minimumVotingTime;
  }

  function addStatusBylaw(string functionSignature, AbstractCompany.EntityStatus statusNeeded) checkBylaws {
    BylawsLib.Bylaw memory bylaw = BylawsLib.init();
    bylaw.status.neededStatus = uint8(statusNeeded);
    bylaw.status.enforced = true;

    addBylaw(functionSignature, bylaw);
  }

  function addSpecialStatusBylaw(string functionSignature, AbstractCompany.SpecialEntityStatus statusNeeded) checkBylaws {
    BylawsLib.Bylaw memory bylaw = BylawsLib.init();
    bylaw.specialStatus.neededStatus = uint8(statusNeeded);
    bylaw.specialStatus.enforced = true;

    addBylaw(functionSignature, bylaw);
  }

  function addVotingBylaw(string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option) checkBylaws {
    BylawsLib.Bylaw memory bylaw = BylawsLib.init();

    bylaw.voting.supportNeeded = support;
    bylaw.voting.supportBase = base;
    bylaw.voting.closingRelativeMajority = closingRelativeMajority;
    bylaw.voting.minimumVotingTime = minimumVotingTime;
    bylaw.voting.approveOption = option;
    bylaw.voting.enforced = true;

    addBylaw(functionSignature, bylaw);
  }

  function addBylaw(string functionSignature, BylawsLib.Bylaw bylaw) private {
    bylaws.addBylaw(functionSignature, bylaw);

    BylawChanged(functionSignature);
  }

  // acl

  function setEntityStatusByStatus(address entity, uint8 status) public {
    if (entityStatus[msg.sender] <= status) throw; // Cannot set same or higher status
    if (entity != msg.sender && entityStatus[entity] >= entityStatus[msg.sender]) throw; // Cannot change status of higher status

    // Exec can set and remove employees.
    // Someone with lesser or same status cannot change ones status
    setStatus(entity, status);
  }

  function setEntityStatusByVoting(address entity, uint8 status) checkBylaws public {
    setStatus(entity, status);
  }

  function setStatus(address entity, uint8 status) private {
    entityStatus[entity] = status;
    EntityNewStatus(entity, status);
  }

  // vote

  function countVotes(uint256 votingId, uint8 optionId) returns (uint256, uint256) {
    var (v, c, tv) = BylawsLib.countVotes(votingId, optionId);
    return (v, tv);
  }

  function setVotingExecuted(uint8 option) {
    uint256 votingId = reverseVotings[msg.sender];
    if (votingId == 0) throw;
    if (voteExecuted[votingId] > 0) throw;

    voteExecuted[votingId] = 10 + option; // avoid 0

    VoteExecuted(votingId, msg.sender, option);
  }

  function beginPoll(address voting, uint64 closes) public checkBylaws {
    Voting v = Voting(voting);
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock(stocks[i]).beginPoll(votingIndex, closes);
    }
    votings[votingIndex] = voting;
    reverseVotings[voting] = votingIndex;
    votingIndex += 1;
  }

  function castVote(uint256 voteId, uint8 option) public checkBylaws {
    if (voteExecuted[voteId] > 0) throw; // cannot vote on executed polls

    for (uint8 i = 0; i < stockIndex; i++) {
      Stock stock = Stock(stocks[i]);
      if (stock.isShareholder(msg.sender)) {
        stock.castVoteFromCompany(msg.sender, voteId, option);
      }
    }
  }

  // stock

  function isShareholder(address holder) constant public returns (bool) {
    for (uint8 i = 0; i < stockIndex; i++) {
      if (Stock(stocks[i]).isShareholder(holder)) {
        return true;
      }
    }
    return false;
  }

  function addStock(address newStock, uint256 issue) checkBylaws public {
    if (Stock(newStock).company() != address(this)) throw;

    IssueableStock(newStock).issueStock(issue);

    stocks[stockIndex] = newStock;
    stockIndex += 1;

    IssuedStock(newStock, stockIndex - 1, issue);
  }

  function issueStock(uint8 _stock, uint256 _amount) checkBylaws public {
    IssueableStock(stocks[_stock]).issueStock(_amount);
    IssuedStock(stocks[_stock], _stock, _amount);
  }

  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting) checkBylaws public {
    issueStock(_stock, _amount);
    GrantableStock(stocks[_stock]).grantVestedStock(_recipient, _amount, _cliff, _vesting);
  }

  function grantStock(uint8 _stock, uint256 _amount, address _recipient) checkBylaws public {
    GrantableStock(stocks[_stock]).grantStock(_recipient, _amount);
  }

  // stock sales

  function beginSale(address saleAddress) checkBylaws public {

    StockSale sale = StockSale(saleAddress);
    if (sale.companyAddress() != address(this)) throw;

    sales[saleIndex] = saleAddress;
    reverseSales[saleAddress] = saleIndex;
    saleIndex += 1;

    NewStockSale(saleAddress, saleIndex - 1, sale.stockId());
  }

  function transferSaleFunds(uint256 _sale) checkBylaws public {
    StockSale(sales[_sale]).transferFunds();
  }

  function isStockSale(address entity) constant public returns (bool) {
    return reverseSales[entity] > 0;
  }

  function assignStock(uint8 stockId, address holder, uint256 units) checkBylaws {
    IssueableStock(stocks[stockId]).issueStock(units);
    GrantableStock(stocks[stockId]).grantStock(holder, units);
  }

  function removeStock(uint8 stockId, address holder, uint256 units) checkBylaws {
    IssueableStock(stocks[stockId]).destroyStock(holder, units);
  }

  // accounting
  function getAccountingPeriodRemainingBudget() constant returns (uint256) {
    var (budget,) = accounting.getAccountingPeriodState(accounting.getCurrentPeriod());
    return budget;
  }

  function getAccountingPeriodCloses() constant returns (uint64) {
    var (,closes) = accounting.getAccountingPeriodState(accounting.getCurrentPeriod());
    return closes;
  }

  function getAccountingInfo() constant returns (uint lastRecurringTransaction, uint lastPeriod) {
    lastRecurringTransaction = accounting.recurringTransactions.length - 1;
    lastPeriod = accounting.currentPeriod;
    return;
  }

  function getPeriodInfo(uint periodIndex) constant returns (uint lastTransaction, uint64 started, uint64 ended, uint256 revenue, uint256 expenses, uint256 dividends) {
    AccountingLib.AccountingPeriod p = accounting.periods[periodIndex];
    lastTransaction = p.transactions.length - 1;
    started = p.startTimestamp;
    ended = p.endTimestamp > 0 ? p.endTimestamp : p.startTimestamp + p.periodDuration;
    expenses = p.expenses;
    revenue = p.revenue;
    dividends = p.dividends;
    return;
  }

  function getTransactionInfo(uint periodIndex, uint transactionIndex) constant returns (bool expense, address from, address to, address approvedBy, uint256 amount, string concept, uint64 timestamp) {
    AccountingLib.Transaction t = accounting.periods[periodIndex].transactions[transactionIndex];
    expense = t.direction == AccountingLib.TransactionDirection.Outgoing;
    from = t.from;
    to = t.to;
    amount = t.amount;
    approvedBy = t.approvedBy;
    timestamp = t.timestamp;
    concept = t.concept;
    return;
  }

  function setAccountingSettings(uint256 budget, uint64 periodDuration, uint256 dividendThreshold) checkBylaws public {
    accounting.setAccountingSettings(budget, periodDuration, dividendThreshold);
  }

  function addTreasure(string concept) payable public returns (bool) {
    accounting.addTreasure(concept);
    return true;
  }

  function registerIncome(string concept) payable public returns (bool) {
    accounting.registerIncome(concept);
    return true;
  }

  function splitIntoDividends() payable {
    uint256 totalDividendBase;
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock st = Stock(stocks[i]);
      totalDividendBase += st.totalSupply() * st.dividendsPerShare();
    }

    for (uint8 j = 0; j < stockIndex; j++) {
      Stock s = Stock(stocks[j]);
      uint256 stockShare = msg.value * (s.totalSupply() * s.dividendsPerShare()) / totalDividendBase;
      s.splitDividends.value(stockShare)();
    }
  }

  function issueReward(address to, uint256 amount, string concept) checkBylaws {
    accounting.sendFunds(amount, concept, to);
  }

  function createRecurringReward(address to, uint256 amount, uint64 period, string concept) checkBylaws {
    accounting.sendRecurringFunds(amount, concept, to, period, true);
  }

  function removeRecurringReward(uint index) checkBylaws {
    accounting.removeRecurringTransaction(index);
  }

  function () payable {
    registerIncome("Fallback donation");
  }
}
