pragma solidity ^0.4.6;

library AccountingLib {
  enum TransactionDirection { Incoming, Outgoing }

  struct Transaction {
    TransactionDirection direction;
    uint256 amount;
    address from;
    address to;
    string concept;
    bool isAccountable;

    address approvedBy;
    uint256 timestamp;
  }

  struct AccountingPeriod {
    uint256 revenue;
    uint256 expenses;
    uint256 dividends;

    Transaction[] transactions;

    uint64 startDate;
    uint64 endDate;
    bool closed;

    // These settings are saved per period too, to know under what settings a period worked.
    uint256 dividendThreshold;
    uint64 periodDuration;
    uint256 budget;
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

    initPeriod(self);
    setAccountingSettings(self, initialBudget, initialPeriodDuration, initialDividendThreshold);

    self.initialized = true;
  }

  function setAccountingSettings(AccountingLedger storage self, uint256 budget, uint64 periodDuration, uint256 dividendThreshold) {
    if (self.periods[self.currentPeriod].expenses > budget) throw; // Cannot set budget below what already has been spent

    self.currentBudget = budget;
    self.currentPeriodDuration = periodDuration;
    self.currentDividendThreshold = dividendThreshold;

    addSettingsToCurrentPeriod(self);
  }

  function addTreasure(AccountingLedger storage self, string concept) {
    saveTransaction(self, TransactionDirection.Incoming, msg.value, msg.sender, this, concept, false);
  }

  function registerIncome(AccountingLedger storage self, string concept) {
    saveTransaction(self, TransactionDirection.Incoming, msg.value, msg.sender, this, concept, true);
  }

  function sendFunds(AccountingLedger storage self, uint256 amount, string concept, address to) {
    saveTransaction(self, TransactionDirection.Outgoing, amount, this, to, concept, true);

    if (!to.send(amount)) { throw; }
  }

  function saveTransaction(AccountingLedger storage self, TransactionDirection direction, uint256 amount, address from, address to, string concept, bool periodAccountable) private {
    Transaction memory transaction = Transaction({ approvedBy: msg.sender, timestamp: uint64(now), direction: direction, amount: amount, from: from, to: to, concept: concept, isAccountable: periodAccountable });

    if (isPeriodOver(self.periods[self.currentPeriod])) closeCurrentPeriod(self);

    if (periodAccountable) accountTransaction(self.periods[self.currentPeriod], transaction);
    self.periods[self.currentPeriod].transactions.push(transaction);
  }

  function initPeriod(AccountingLedger storage self) private {
    self.currentPeriod = self.periods.length;
    self.periods.length += 1;

    AccountingPeriod period = self.periods[self.currentPeriod];
    period.startDate = uint64(now);

    // In the first period settings will be 0 at the time of creation and unexpected behaviour may happen.
    if (self.currentPeriod > 0) addSettingsToCurrentPeriod(self);
  }

  function addSettingsToCurrentPeriod(AccountingLedger storage self) private {
    AccountingPeriod period = self.periods[self.currentPeriod];

    period.budget = self.currentBudget;
    period.periodDuration = self.currentPeriodDuration;
    period.dividendThreshold = self.currentDividendThreshold;
  }

  function isPeriodOver(AccountingPeriod storage period) constant private returns (bool) {
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

  function accountTransaction(AccountingPeriod storage period, Transaction transaction) private {
    if (transaction.direction == TransactionDirection.Incoming) {
      period.revenue += transaction.amount;
    } else {
      if (period.expenses + transaction.amount > period.budget) throw; // Can't go over budget
      period.expenses += transaction.amount;
    }
  }
}
