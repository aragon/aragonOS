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

  struct RecurringTransaction {
    Transaction transaction;
    uint64 period;

    uint256 performed;
    uint64 lastTransactionDate;
  }

  struct AccountingPeriod {
    uint256 revenue;
    uint256 expenses;
    uint256 dividends;

    Transaction[] transactions;

    uint64 startTimestamp;
    uint64 endTimestamp;
    bool closed;

    // These settings are saved per period too, to know under what settings a period worked.
    uint256 dividendThreshold;
    uint64 periodDuration;
    uint256 budget;
  }

  struct AccountingLedger {
    bool initialized;
    AccountingPeriod[] periods;
    RecurringTransaction[] recurringTransactions;
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
    if (getCurrentPeriod(self).expenses > budget) throw; // Cannot set budget below what already has been spent

    self.currentBudget = budget;
    self.currentPeriodDuration = periodDuration;
    self.currentDividendThreshold = dividendThreshold;

    addSettingsToCurrentPeriod(self);
  }

  function getCurrentPeriod(AccountingLedger storage self) internal returns (AccountingPeriod storage) {
    return self.periods[self.currentPeriod];
  }

  // Do not call inside a transaction (only eth_call) as it closes period if needed
  function getAccountingPeriodState(AccountingLedger storage self) constant returns (uint256 remainingBudget, uint64 periodCloses) {
    performDueTransactions(self);

    AccountingPeriod period = getCurrentPeriod(self);

    remainingBudget = period.budget - period.expenses;
    periodCloses = period.startTimestamp + period.periodDuration;
    return;
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

  function sendRecurrentFunds(AccountingLedger storage self, uint256 amount, string concept, address to, uint64 period, bool startNow) {
    Transaction memory transaction = Transaction({ approvedBy: msg.sender, timestamp: 0, direction: TransactionDirection.Outgoing, amount: amount, from: this, to: to, concept: concept, isAccountable: true });
    RecurringTransaction memory recurring = RecurringTransaction( { transaction: transaction, period: period, lastTransactionDate: uint64(now), performed: 0 } );
    if (startNow) recurring.lastTransactionDate -= period;

    // Check if address can receive ether, so it won't throw when performing recurring transactions
    // Problem: if address is a contract, a malicious actor could make it that it throws at any time by changing a parameter.
    // function () payable { if (makeItBreakNow) throw; }
    // This check mitigates the risk, but it is not perfect
    // TODO: Add way to see what transaction is failing and remove it.

    sendFunds(self, 1 wei, 'testing it can receive money', to);

    self.recurringTransactions.push(recurring);
  }

  function saveTransaction(AccountingLedger storage self, TransactionDirection direction, uint256 amount, address from, address to, string concept, bool periodAccountable) private {
    Transaction memory transaction = Transaction({ approvedBy: msg.sender, timestamp: uint64(now), direction: direction, amount: amount, from: from, to: to, concept: concept, isAccountable: periodAccountable });

    saveTransaction(self, transaction, periodAccountable, true);
  }

  function performDueTransactions(AccountingLedger storage self) {
    if (isPeriodOver(getCurrentPeriod(self))) closeCurrentPeriod(self);
    performDueRecurringTransactions(self);
  }

  function saveTransaction(AccountingLedger storage self, Transaction transaction, bool periodAccountable, bool needsCheck) private {
    if (needsCheck) performDueTransactions(self);
    if (periodAccountable) accountTransaction(getCurrentPeriod(self), transaction);

    getCurrentPeriod(self).transactions.push(transaction);
  }

  function performDueRecurringTransactions(AccountingLedger storage self) private {
    for (uint256 i = 0; i < self.recurringTransactions.length; i++) {
      RecurringTransaction recurring = self.recurringTransactions[i];
      if (recurring.lastTransactionDate + recurring.period <= now) {
        recurring.transaction.timestamp = uint64(now);
        recurring.lastTransactionDate = recurring.lastTransactionDate + recurring.period;

        // Problem: this will throw and block all accounting if one recurring transaction fails.
        if (!recurring.transaction.to.send(recurring.transaction.amount)) { throw; }

        saveTransaction(self, recurring.transaction, true, false); // question: does it copy it or inserts recurring transaction
        recurring.performed += 1;
      }
    }
  }

  function initPeriod(AccountingLedger storage self) private {
    self.currentPeriod = self.periods.length;
    self.periods.length += 1;

    AccountingPeriod period = getCurrentPeriod(self);
    period.startTimestamp = uint64(now);

    // In the first period settings will be 0 at the time of creation and unexpected behaviour may happen.
    if (self.currentPeriod > 0) addSettingsToCurrentPeriod(self);
  }

  function addSettingsToCurrentPeriod(AccountingLedger storage self) private {
    AccountingPeriod period = getCurrentPeriod(self);

    period.budget = self.currentBudget;
    period.periodDuration = self.currentPeriodDuration;
    period.dividendThreshold = self.currentDividendThreshold;
  }

  function isPeriodOver(AccountingPeriod storage period) constant private returns (bool) {
    return period.startTimestamp + period.periodDuration < now;
  }

  function closeCurrentPeriod(AccountingLedger storage self) {
    AccountingPeriod period = getCurrentPeriod(self);
    int256 periodResult = int256(period.revenue) - int256(period.expenses);

    if (periodResult > 0 && periodResult > int256(period.dividendThreshold)) {
      period.dividends = uint256(periodResult) - period.dividendThreshold;
    }

    period.endTimestamp = uint64(now);

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
