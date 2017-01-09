pragma solidity ^0.4.6;

library AccountingLib {
  enum TransactionDirection { Incoming, Outgoing }

  struct Transaction {
    TransactionDirection direction;
    uint256 amount;
    address from;
    address to;
    string concept;

    address approvedBy;
    uint256 timestamp;
  }

  struct AccountingPeriod {
    uint256 budget;
    uint256 revenue;
    uint256 expenses;
    uint256 dividends;
    uint256 dividendThreshold;
    Transaction[] transactions;

    uint64 startDate;
    uint64 periodDuration;
    uint64 endDate;

    bool closed;
  }

  struct AccountingLedger {
    bool initialized;
    AccountingPeriod[] periods;
    uint256 currentPeriod;

    uint256 currentBudget;
    uint64 currentPeriodDuration;
    uint256 currentDividendThreshold;
  }

  function init(AccountingLedger storage self, uint256 initialBudget, uint64 initialPeriodDuration, uint256 initialDividendThreshold) {
    if (self.initialized) throw;

    self.currentBudget = initialBudget;
    self.currentPeriodDuration = initialPeriodDuration;
    self.currentDividendThreshold = initialDividendThreshold;

    initPeriod(self);

    self.initialized = true;
  }

  function initPeriod(AccountingLedger storage self) private {
    self.currentPeriod = self.periods.length;
    self.periods.length += 1;

    AccountingPeriod period = self.periods[self.currentPeriod];
    period.budget = self.currentBudget;
    period.startDate = uint64(now);
    period.periodDuration = self.currentPeriodDuration;
  }

  function isPeriodOver(AccountingPeriod storage period) constant returns (bool) {
    return period.startDate + period.periodDuration < now;
  }

  function closeCurrentPeriod(AccountingLedger storage self) {
    AccountingPeriod period = self.periods[self.currentPeriod];
    int256 periodResult = int256(period.revenue) - int256(period.expenses);

    if (periodResult > 0 && periodResult > int256(period.dividendThreshold)) {
      period.dividends = uint256(periodResult) - period.dividendThreshold;
    }

    period.endDate = uint64(now);

    initPeriod(self);
  }

  function saveTransaction(AccountingLedger storage self, TransactionDirection direction, uint256 amount, address from, address to, string concept) {
    Transaction memory transaction = Transaction({ approvedBy: msg.sender, timestamp: uint64(now), direction: direction, amount: amount, from: from, to: to, concept: concept });

    if (isPeriodOver(self.periods[self.currentPeriod])) closeCurrentPeriod(self);

    addTransaction(self.periods[self.currentPeriod], transaction);
  }

  function addTransaction(AccountingPeriod storage period, Transaction transaction) private {
    if (transaction.direction == TransactionDirection.Incoming) {
      period.revenue += transaction.amount;
    } else {
      if (period.expenses + transaction.amount > period.budget) throw; // Can't go over budget
      period.expenses += transaction.amount;
    }

    period.transactions.push(transaction);
  }
}
