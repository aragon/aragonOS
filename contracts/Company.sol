pragma solidity ^0.4.8;

import "./AbstractCompany.sol";

import "./accounting/AccountingLib.sol";
import "./bylaws/BylawsLib.sol";
import "./votes/VotingLib.sol";

import "./stocks/Stock.sol";
import "./stocks/IssueableStock.sol";

import "./votes/BinaryVoting.sol";
import "./votes/GenericBinaryVoting.sol";

import "./sales/AbstractStockSale.sol";

contract Company is AbstractCompany {
  using AccountingLib for AccountingLib.AccountingLedger;
  using BylawsLib for BylawsLib.Bylaws;
  using BylawsLib for BylawsLib.Bylaw;
  using VotingLib for VotingLib.Votings;

  AccountingLib.AccountingLedger accounting;
  BylawsLib.Bylaws bylaws;
  VotingLib.Votings votings;

  function Company() payable {
    saleIndex = 1; // Reverse index breaks when it is zero.

    accounting.init(1 ether, 4 weeks, 1 wei); // Init with 1 ether budget and 1 moon period
    votings.init();
    // Make contract deployer executive
    setStatus(msg.sender, uint8(AbstractCompany.EntityStatus.God));
  }

  modifier checkBylaws {
    // Save current bylaw for passing to performed action in case of bylaw change
    BylawsLib.Bylaw bylaw = bylaws.bylaws[msg.sig];
    if (!canPerformAction(bylaw, msg.sig, msg.sender, msg.data)) throw;
    _;
    bylaw.performedAction(msg.sig, msg.sender);
  }

  function canPerformAction(bytes4 sig, address sender, bytes data) constant public returns (bool) {
    return canPerformAction(bylaws.bylaws[sig], sig, sender, data);
  }

  function canPerformAction(BylawsLib.Bylaw storage bylaw, bytes4 sig, address sender, bytes data) internal returns (bool) {
    return bylaw.canPerformAction(sig, sender, data, msg.value);
  }

  function sigPayload(uint n) constant public returns (bytes32) {
    return keccak256(0x19, "Ethereum Signed Message:\n48Voting pre-auth ", hashedPayload(address(this), n)); // length = 32 + 16
  }

  function hashedPayload(address c, uint n) constant public returns (bytes32) {
    return keccak256(c, n);
  }

  modifier checkSignature(address sender, bytes32 r, bytes32 s, uint8 v, uint nonce) {
    bytes32 signingPayload = sigPayload(nonce);
    if (usedSignatures[signingPayload]) throw;
    if (sender != ecrecover(signingPayload, v, r, s)) throw;
    usedSignatures[signingPayload] = true;
    _;
  }

  function beginUntrustedPoll(address voting, uint64 closingTime, address sender, bytes32 r, bytes32 s, uint8 v, uint nonce) checkSignature(sender, r, s, v, nonce) {
    // 0x30ade7af = BylawsLib.keyForFunctionSignature("beginPoll(address,uint64,bool,bool)")
    if (!canPerformAction(0x30ade7af, sender, new bytes(0))) throw;
    doBeginPoll(voting, closingTime, false, false); // TODO: Make vote on create and execute great again
  }

  function getBylawType(string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy) {
    return bylaws.getBylawType(functionSignature);
  }

  function getStatusBylaw(string functionSignature) constant returns (uint8) {
    BylawsLib.Bylaw memory b = bylaws.getBylaw(functionSignature);

    if (b.status.enforced) return b.status.neededStatus;

    return uint8(255);
  }

  function getVotingBylaw(string functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    return getVotingBylaw(bytes4(sha3(functionSignature)));
  }

  function getVotingBylaw(bytes4 functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    BylawsLib.VotingBylaw memory b = bylaws.getBylaw(functionSignature).voting;

    if (!b.enforced) return;

    support = b.supportNeeded;
    base = b.supportBase;
    closingRelativeMajority = b.closingRelativeMajority;
    minimumVotingTime = b.minimumVotingTime;
  }

  function getAddressBylaw(string functionSignature) constant returns (address) {
    BylawsLib.AddressBylaw memory b = bylaws.getBylaw(functionSignature).addr;

    if (!b.enforced) return;

    return b.addr;
  }

  function setStatusBylaw(string functionSignature, uint statusNeeded, bool isSpecialStatus) checkBylaws {
    bylaws.setStatusBylaw(functionSignature, statusNeeded, isSpecialStatus);
  }

  function setAddressBylaw(string functionSignature, address addr, bool isOracle) checkBylaws {
    bylaws.setAddressBylaw(functionSignature, addr, isOracle);
  }

  function setVotingBylaw(string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option) checkBylaws {
    bylaws.setVotingBylaw(functionSignature, support, base, closingRelativeMajority, minimumVotingTime, option);
  }

  // acl

  function setEntityStatusByStatus(address entity, uint8 status) public {
    if (entityStatus[msg.sender] < status) throw; // Cannot set higher status
    if (entity != msg.sender && entityStatus[entity] >= entityStatus[msg.sender]) throw; // Cannot change status of higher status

    // Exec can set and remove employees.
    // Someone with lesser or same status cannot change ones status
    setStatus(entity, status);
  }

  function setEntityStatus(address entity, uint8 status) checkBylaws public {
    setStatus(entity, status);
  }

  function setStatus(address entity, uint8 status) private {
    entityStatus[entity] = status;
    EntityNewStatus(entity, status);
  }

  // vote

  function beginPoll(address voting, uint64 closes, bool voteOnCreate, bool executesIfDecided) public checkBylaws {
    return doBeginPoll(voting, closes, voteOnCreate, executesIfDecided);
  }

  function doBeginPoll(address voting, uint64 closes, bool voteOnCreate, bool executesIfDecided) private {
    address[] memory governanceTokens = new address[](stockIndex);
    for (uint8 i = 0; i < stockIndex; i++) {
      governanceTokens[i] = stocks[i];
    }
    uint256 votingId = votings.createVoting(voting, governanceTokens, closes, uint64(now));
    // if (voteOnCreate) castVote(votingId, uint8(BinaryVoting.VotingOption.Favor), executesIfDecided);
  }

  // Bylaw for cast vote and modify is not really needed, as voting lib has sender into account at all times.
  function castVote(uint256 votingId, uint8 option, bool executesIfDecided) public /*checkBylaws*/ {
    votings.castVote(votingId, msg.sender, option);
    if (executesIfDecided) executeAfterVote(votingId);
  }

  // TODO: Add bylaw
  function modifyVote(uint256 votingId, uint8 option, bool removes, bool executesIfDecided) public {
    votings.modifyVote(votingId, msg.sender, option, removes);
    if (executesIfDecided) executeAfterVote(votingId);
  }

  function setVotingExecuted(uint256 votingId, uint8 option) {
    if (msg.sender != address(this)) throw; // address specific bylaw to company
    votings.closeExecutedVoting(votingId, option);
  }

  function executeAfterVote(uint256 votingId) private {
    address votingAddress = votings.votingAddress(votingId);
    bool canPerform = canPerformAction(BinaryVoting(votingAddress).mainSignature(), votingAddress, new bytes(0));
    if (canPerform) {
      BinaryVoting(votingAddress).executeOnAction(uint8(BinaryVoting.VotingOption.Favor), this);
    }
  }

  function reverseVoting(address votingAddress) constant public returns (uint256 votingId) {
    return votings.reverseVotings[votingAddress];
  }

  function getVotingInfo(uint256 votingId) constant public returns (address votingAddress, uint64 startDate, uint64 closeDate, bool isExecuted, uint8 executed, bool isClosed) {
    return votings.getVotingInfo(votingId);
  }

  function countVotes(uint256 votingId, uint8 optionId) constant public returns (uint256 votes, uint256 totalCastedVotes, uint256 totalVotingPower) {
    return votings.countVotes(votingId, optionId);
  }

  function votingPowerForVoting(uint256 votingId) constant public returns (uint256 votable, uint256 modificable, uint8 voted) {
    return votings.votingPowerForVoting(votingId, msg.sender);
  }

  function hasVotedInOpenedVoting(address holder) constant public returns (bool) {
    return votings.hasVotedInOpenedVoting(holder);
  }

  // stock
  function isShareholder(address holder) constant public returns (bool) {
    for (uint8 i = 0; i < stockIndex; i++) {
      if (Stock(stocks[i]).isShareholder(holder)) {
        return true;
      }
    }
  }

  function addStock(address newStock, uint256 issue) checkBylaws public {
    if (Stock(newStock).governingEntity() != address(this)) throw;
    // TODO: check stock not present yet
    if (issue > 0) IssueableStock(newStock).issueStock(issue);
    votings.addGovernanceToken(newStock);

    stocks[stockIndex] = newStock;
    stockIndex += 1;

    IssuedStock(newStock, stockIndex - 1, issue);
  }

  function issueStock(uint8 _stock, uint256 _amount) checkBylaws public {
    IssueableStock(stocks[_stock]).issueStock(_amount);
    IssuedStock(stocks[_stock], _stock, _amount);
  }

  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _start, uint64 _cliff, uint64 _vesting) checkBylaws public {
    Stock(stocks[_stock]).grantVestedTokens(_recipient, _amount, _start, _cliff, _vesting);
  }

  function grantStock(uint8 _stock, uint256 _amount, address _recipient) checkBylaws public {
    Stock(stocks[_stock]).transfer(_recipient, _amount);
  }

  // stock sales

  function beginSale(address saleAddress) checkBylaws public {
    AbstractStockSale sale = AbstractStockSale(saleAddress);
    if (sale.companyAddress() != address(this)) throw;

    sales[saleIndex] = saleAddress;
    reverseSales[saleAddress] = saleIndex;
    saleIndex += 1;

    NewStockSale(saleAddress, saleIndex - 1, sale.stockId());
  }

  function transferSaleFunds(uint256 _sale) checkBylaws public {
    AbstractStockSale(sales[_sale]).transferFunds();
  }

  function isStockSale(address entity) constant public returns (bool) {
    return reverseSales[entity] > 0;
  }

  function assignStock(uint8 stockId, address holder, uint256 units) checkBylaws {
    IssueableStock(stocks[stockId]).issueStock(units);
    Stock(stocks[stockId]).transfer(holder, units);
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

  function getPeriodInfo(uint periodIndex) constant returns (uint lastTransaction, uint64 started, uint64 ended, uint256 revenue, uint256 expenses, uint256 dividends) {
    AccountingLib.AccountingPeriod p = accounting.periods[periodIndex];
    lastTransaction = p.transactions.length - 1;
    started = p.startTimestamp;
    ended = p.endTimestamp > 0 ? p.endTimestamp : p.startTimestamp + p.periodDuration;
    expenses = p.expenses;
    revenue = p.revenue;
    dividends = p.dividends;
  }

  function getRecurringTransactionInfo(uint transactionIndex) constant returns (uint64 period, uint64 lastTransactionDate, address to, address approvedBy, uint256 amount, string concept) {
    AccountingLib.RecurringTransaction recurring = accounting.recurringTransactions[transactionIndex];
    AccountingLib.Transaction t = recurring.transaction;
    period = recurring.period;
    to = t.to;
    amount = t.amount;
    approvedBy = t.approvedBy;
    concept = t.concept;
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
  }

  function setAccountingSettings(uint256 budget, uint64 periodDuration, uint256 dividendThreshold) checkBylaws public {
    accounting.setAccountingSettings(budget, periodDuration, dividendThreshold);
  }

  function addTreasure(string concept) payable public returns (bool) {
    accounting.addTreasure(concept);
    return true;
  }

  /*
  function registerIncome(string concept) payable public returns (bool) {
    accounting.registerIncome(concept);
    return true;
  }
  */

  function splitIntoDividends() payable {
    /*
    TODO: Removed for gas limitations
    uint256 totalDividendBase;
    for (uint8 i = 0; i < stockIndex; i++) {
      Stock st = Stock(stocks[i]);
      totalDividendBase += st.totalSupply() * st.economicRights();
    }

    for (uint8 j = 0; j < stockIndex; j++) {
      Stock s = Stock(stocks[j]);
      uint256 stockShare = msg.value * (s.totalSupply() * s.economicRights()) / totalDividendBase;
      s.splitDividends.value(stockShare)();
    }
    */
  }

  function issueReward(address to, uint256 amount, string concept) checkBylaws {
    accounting.sendFunds(amount, concept, to);
  }

  function createRecurringReward(address to, uint256 amount, uint64 period, string concept) checkBylaws {
    accounting.sendRecurringFunds(amount, concept, to, period, true);
  }

  function removeRecurringReward(uint index) checkBylaws {
    // TODO: Gas cuts
    // accounting.removeRecurringTransaction(index);
  }
}
