pragma solidity ^0.4.6;

import "../AbstractCompany.sol";

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
    uint64 timestamp;
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
    address company;

    AccountingPeriod[] periods;
    RecurringTransaction[] recurringTransactions;
    uint256 currentPeriod;

    uint256 currentBudget;
    uint64 currentPeriodDuration;
    uint256 currentDividendThreshold;
  }

  function init(AccountingLedger storage self, uint256 initialBudget, uint64 initialPeriodDuration, uint256 initialDividendThreshold, address company) {
    if (self.initialized) throw;

    self.company = company;
    initPeriod(self, uint64(now));
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

  function getPeriodIndexForTimestamp(AccountingLedger storage self, uint64 timestamp) internal returns (uint) {
    if (self.periods[0].startTimestamp > timestamp) throw;

    uint i = 0;
    while (i <= self.currentPeriod) {
      AccountingPeriod period = self.periods[i];
      if (period.startTimestamp <= timestamp) {
        if (period.endTimestamp > timestamp) return i;
        if (self.currentPeriod == i && period.startTimestamp + period.periodDuration > timestamp) return i;
      }
      i++;
    }

    throw;
  }

  // Do not call inside a transaction (only eth_call) as it closes period if needed
  function getAccountingPeriodState(AccountingLedger storage self, AccountingPeriod storage period) constant returns (uint256 remainingBudget, uint64 periodCloses) {
    performDueTransactions(self);

    remainingBudget = period.budget - projectPeriodExpenses(self, period);
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

  function sendRecurringFunds(AccountingLedger storage self, uint256 amount, string concept, address to, uint64 period, bool startNow) {
    Transaction memory transaction = Transaction({ approvedBy: msg.sender, timestamp: 0, direction: TransactionDirection.Outgoing, amount: amount, from: this, to: to, concept: concept, isAccountable: true });
    RecurringTransaction memory recurring = RecurringTransaction( { transaction: transaction, period: period, lastTransactionDate: uint64(now), performed: 0 } );
    if (startNow) recurring.lastTransactionDate -= period;

    // Check if address can receive ether, so it won't throw when performing recurring transactions
    // Problem: if address is a contract, a malicious actor could make it that it throws at any time by changing a parameter.
    // function () payable { if (makeItBreakNow) throw; }
    // This check mitigates the risk, but it is not perfect
    // TODO: Add way to see what transaction is failing and remove it.
    sendFunds(self, 1 wei, 'testing it can receive money', to); // This will also cause period change if needed

    AccountingPeriod currentPeriod = getCurrentPeriod(self);
    uint256 periodExpenses = projectPeriodExpenses(self, currentPeriod);
    uint256 recurringExpense = projectRecurringTransactionExpense(currentPeriod, recurring);
    if (periodExpenses + recurringExpense > currentPeriod.budget) throw; // Adding recurring transaction will make go over budget in the future

    self.recurringTransactions.push(recurring);
  }

  function removeRecurringTransaction(AccountingLedger storage self, uint index) {
    if (index >= self.recurringTransactions.length) throw; // out of bounds

    delete self.recurringTransactions[index];
    self.recurringTransactions[index] = self.recurringTransactions[self.recurringTransactions.length - 1];
    self.recurringTransactions.length -= 1;
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
    if (periodAccountable) accountTransaction(self, getCurrentPeriod(self), transaction);

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

  function initPeriod(AccountingLedger storage self, uint64 startTime) private {
    self.currentPeriod = self.periods.length;
    self.periods.length += 1;

    AccountingPeriod period = getCurrentPeriod(self);
    period.startTimestamp = startTime;

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
      AbstractCompany(self.company).splitIntoDividends.value(period.dividends)();
    }

    period.endTimestamp = uint64(period.startTimestamp + period.periodDuration);

    initPeriod(self, period.endTimestamp);
  }

  function projectPeriodExpenses(AccountingLedger storage self, AccountingPeriod storage period) returns (uint256 expenses) {
    expenses = period.expenses;

    for (uint256 i = 0; i < self.recurringTransactions.length; i++) {
      expenses += projectRecurringTransactionExpense(period, self.recurringTransactions[i]);
    }
    return;
  }

  function projectRecurringTransactionExpense(AccountingPeriod memory period, RecurringTransaction memory recurring) internal returns (uint256) {
    uint64 periodEnds = period.startTimestamp + period.periodDuration;
    uint256 n = uint256(periodEnds - recurring.lastTransactionDate) / recurring.period; // TODO: Make sure rounding works as intended (floor)
    return n * recurring.transaction.amount;
  }

  function accountTransaction(AccountingLedger storage self, AccountingPeriod storage period, Transaction transaction) private {
    if (transaction.direction == TransactionDirection.Incoming) {
      period.revenue += transaction.amount;
    } else {
      if (projectPeriodExpenses(self, period) + transaction.amount > period.budget) throw; // Can't go over budget
      period.expenses += transaction.amount;
    }
  }
}
