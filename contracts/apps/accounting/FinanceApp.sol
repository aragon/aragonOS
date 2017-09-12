pragma solidity ^0.4.15;

import "../App.sol";
import "../../common/Initializable.sol";
import "zeppelin-solidity/contracts/token/ERC20.sol";
import "../vault/Vault.sol";



contract FinanceApp is App, Initializable {

    Vault vault;

    struct AccountingPeriod {

        bytes2 ct_second;
        bytes2 ct_minute;
        bytes2 ct_hour;
        bytes2 ct_day;
        bytes2 ct_month;
        bytes2 ct_weekday;
        bytes2 ct_year;
        uint startBlock;
        uint startTimestamp;
        uint endTimestamp;
        ERC20[] budgetTokens;
        uint[] budgetAmounts;

    }

    AccountingPeriod public defaultAccountingPeriodSettings;
    AccountingPeriod[] public accountingPeriods; // Perhaps use a mapping?

    // The concept of sending tokens to or from the org
    struct Transaction {
        address token;
        uint amount;
        address externalAddress;
        string reference;
        uint timestamp;
        uint accountingPeriodId;  // in which accounting period did this occur
        TransactionType _type;
    }
    enum TransactionType {
        Deposit,
        Withdrawal
    }


    // The state a transaction update can be.
    // New states should be added to the end to maintain the
    // order of the index when interfacing with web3.
    enum TransactionState {
        New, // not needed?
        PendingApproval,
        Failed,
        Succeeded,
        Approved,
        Denied
    }

    // The change in Transaciton state over time
    struct TransactionUpdate {
        uint transactionId; // Parent Transaction
        TransactionState state;
        string reason;
        address actor; // who performed this update
    }

    Transaction[] public transactions;
    TransactionUpdate[] public transactionUpdates;

    // throttledFunctions[string key] = timstamp last run
    mapping (string => uint) throttledFunctions;

    // Reverse relation of a Transaction ID  -> TransactionsUpdatesIds[]
    // transactionUpdatesRelation[tid] = [tuid_0..tuid_N]
    mapping (uint => uint[]) public transactionUpdatesRelation;

    event WithdrawalFailed(uint transactionId);

    function () {
    }

    function FinanceApp() {
    }


    function getCurrentAccountingPeriodId() public constant returns (uint){
        // TODO: perhaps we should store the current accountingPeriod ID
        // separately and allow accounting periods to be generated in advance.
        // For now the current period is the most recent one
        return accountingPeriods.length - 1;
    }

    function getCurrentAccountingPeriod() public constant returns (bytes2, bytes2, bytes2, bytes2, bytes2, bytes2, bytes2){
        AccountingPeriod memory ap = accountingPeriods[getCurrentAccountingPeriodId()];
        return (ap.ct_second, ap.ct_minute, ap.ct_hour, ap.ct_day, ap.ct_month, ap.ct_weekday, ap.ct_year);
    }

    function getAccountingPeriodsLength() public constant returns (uint) {
        return accountingPeriods.length;
    }

    function getTransactionsLength() public constant returns (uint) {
        return transactions.length;
    }

    // This flattens the last TransactionUpdate with the base Transation to show the current state of the transaction.
    // This assumes that there is at least a single transaction update which is fine if newTransaction is used.
    function getTransactionInfo(uint transactionId) constant returns (address, address, uint, string, TransactionType) {
        Transaction memory t = transactions[transactionId];
        uint tuid = transactionUpdatesRelation[transactionId].length - 1;
        uint lastTransactionUpdate = transactionUpdatesRelation[transactionId][tuid];
        TransactionUpdate tu = transactionUpdates[lastTransactionUpdate];
        return (t.externalAddress, t.token, t.amount, t.reference, t._type);
    }

    function getTransactionState(uint transactionId) constant returns (TransactionState, string) {
        Transaction memory t = transactions[transactionId];
        uint tuid = transactionUpdatesRelation[transactionId].length - 1;
        uint lastTransactionUpdate = transactionUpdatesRelation[transactionId][tuid];
        TransactionUpdate tu = transactionUpdates[lastTransactionUpdate];
        return (tu.state, tu.reason);
    }

    function startNextAccountingPeriod() internal {
        if(accountingPeriods.length == 0 || accountingPeriods[getCurrentAccountingPeriodId()].endTimestamp < now){
            AccountingPeriod memory ap = defaultAccountingPeriodSettings;
            ap.startTimestamp = now;
            uint endTimestamp = next(ap.ct_second, ap.ct_minute, ap.ct_hour, ap.ct_day, ap.ct_month, ap.ct_weekday, ap.ct_year, now);
            ap.endTimestamp = endTimestamp;
            // TODO: store endBlock of last accountingPeriod?
            ap.startBlock = block.number;
            accountingPeriods.push(ap);
            vault.requestAllowances(ap.budgetTokens, ap.budgetAmounts);
        }
    }

    function next() external {
        startNextAccountingPeriod();
    }

    function initialize(address vaultAddress) onlyInit {
        initialized();
        vault = Vault(vaultAddress);
    }

    function _setBudgetToken(address _tokenAddress, uint amount) internal {
        // We cannot just remove a token when the amount is 0 because then it will remain with the available allowance forever.
        var defautAP = defaultAccountingPeriodSettings;
        assert(defautAP.budgetTokens.length == defautAP.budgetAmounts.length);
        for (uint i = 0; i < budgetTokens.length; i++) {
            // this is an existing token and we can about the amount
            if(address(budgetTokens) == _tokenAddress) {
                budgetAmounts[i] = amount;
                return; // early return
            }
        }
        // This means this is a new token, amount and needs to be appended
        budgetTokens.push(ERC20(_tokenAddress));
        budgetAmounts.push(amount);
    }

    function setBudgetToken(address _tokenAddress, uint amount) auth external {
        _setBudgetToken(tokenAddress, amount);
    }

    function setDefaultAccountingPeriodSettings(bytes2 ct_second, bytes2 ct_minute, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday, bytes2 ct_year) auth {
        defaultAccountingPeriodSettings.ct_hour = ct_second;
        defaultAccountingPeriodSettings.ct_hour = ct_minute;
        defaultAccountingPeriodSettings.ct_hour = ct_hour;
        defaultAccountingPeriodSettings.ct_day = ct_day;
        defaultAccountingPeriodSettings.ct_month = ct_month;
        defaultAccountingPeriodSettings.ct_weekday = ct_weekday;
        defaultAccountingPeriodSettings.ct_year = ct_year;
    }

    function newIncomingTransaction(address externalAddress, address token, uint256 amount, string reference) auth  {
        newTransaction(externalAddress, token, amount, reference, TransactionType.Deposit);
    }

    function newOutgoingTransaction(address externalAddress, address token, uint256 amount, string reference) auth  {
        uint transactionId = newTransaction(externalAddress, token, amount, reference, TransactionType.Withdrawal);
        setTransactionPendingApproval(transactionId, 'pending');
    }

    // Create a new transaction and return the id of the new transaction.
    // externalAddress is where the transication is coming or going to.
    function newTransaction(address externalAddress, address token, uint256 amount, string reference, TransactionType _type) internal returns (uint) {
        AccountingPeriod ap = accountingPeriods[getCurrentAccountingPeriodId()];
        uint tid = transactions.push(Transaction({
            token: token,
            amount: amount,
            externalAddress: externalAddress,
            reference: reference,
            timestamp: now,
            accountingPeriodId: getCurrentAccountingPeriodId(),
            _type: _type
        })) - 1;
        // All transactions must have at least one state.
        // To optimize, incoming transactions could go directly to "Suceeded" or "Failed".

        updateTransaction(tid, TransactionState.New, "new");
        return tid;
    }

    function approveTransaction(uint transactionId, string reason) auth  {
        Transaction memory t = transactions[transactionId];
        var (state, r) = getTransactionState(transactionId);
        require(state == TransactionState.PendingApproval);
        require(t._type == TransactionType.Withdrawal);
        setTransactionApproved(transactionId, reason);
        executeTransaction(transactionId);
    }

    function executeTransaction(uint transactionId) auth  {
        Transaction memory t = transactions[transactionId];
        var (state, r) = getTransactionState(transactionId);
        require(state == TransactionState.Approved);
        bool succeeded = t.token.call(TRANSFER_SIG, t.token, t.externalAddress, t.amount);
        if(succeeded) {
            setTransactionSucceeded(transactionId, 'succeed');
        } else {
            WithdrawalFailed(transactionId);
        }
    }

    function setTransactionSucceeded(uint transactionId, string reason) internal   {
        updateTransaction(transactionId, TransactionState.Succeeded, reason);
    }

    function setTransactionFailed(uint transactionId, string reason) internal  {
        var (state, r) = getTransactionState(transactionId);
        require(state == TransactionState.New);
        updateTransaction(transactionId, TransactionState.Failed, reason);
    }

    // Create new transactionUpdate for the given transaction id
    function updateTransaction(uint transactionId, TransactionState state, string reason) internal {
        uint tuid = transactionUpdates.push(TransactionUpdate({
            transactionId: transactionId,
            state: state,
            reason: reason,
            actor: msg.sender
        })) - 1;
        transactionUpdatesRelation[transactionId].push(tuid);
    }

    function setTransactionPendingApproval(uint transactionId, string reason) internal {
        var (state, r) = getTransactionState(transactionId);
        require(state == TransactionState.New);
        updateTransaction(transactionId, TransactionState.PendingApproval, reason);
    }

    function setTransactionApproved(uint transactionId, string reason) internal {
        var (state, r) = getTransactionState(transactionId);
        require(state == TransactionState.PendingApproval);
        updateTransaction(transactionId, TransactionState.Approved, reason);
    }
    bytes4 constant TRANSFER_SIG = bytes4(sha3('transfer(address,address,uint256)'));


}
