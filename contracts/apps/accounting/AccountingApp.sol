pragma solidity ^0.4.11;

import "../../kernel/Kernel.sol";
import "../Application.sol";
import "../../misc/Crontab.sol";


contract AccountingApp is Application {

    //
    // Accounting Periods
    //

    struct AccountingPeriod {
        address baseToken;
        
        bytes2 ct_hour;
        bytes2 ct_day;
        bytes2 ct_month;
        bytes2 ct_weekday;
        uint start;
        uint end;
    }

    AccountingPeriod public defaultAccountingPeriodSettings;

    AccountingPeriod[] public accountingPeriods; // Perhaps use a mapping?

    function getCurrentAccountingPeriodId() returns (uint){
        require(accountingPeriods.length > 0);
        // TODO: perhaps we should store the current accountingPeriod ID
        // separately and allow accounting periods to be generated in advance.
        // For now the current period is the most recent one
        return accountingPeriods.length - 1;
    }

    function getCurrentAccountingPeriod() returns (address baseToken, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday){
        AccountingPeriod memory ap = accountingPeriods[getCurrentAccountingPeriodId()];
        return (ap.baseToken, ap.ct_hour, ap.ct_day, ap.ct_month, ap.ct_weekday);
    }

    function startNextAccountingPeriod() {
        AccountingPeriod memory ap = defaultAccountingPeriodSettings;
        accountingPeriods.push(ap);
    }

    function setDefaultAccountingPeriodSettings(address baseToken, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday) {
        defaultAccountingPeriodSettings.baseToken = baseToken;
        defaultAccountingPeriodSettings.ct_hour = ct_hour;
        defaultAccountingPeriodSettings.ct_day = ct_day;
        defaultAccountingPeriodSettings.ct_month = ct_month;
        defaultAccountingPeriodSettings.ct_weekday = ct_weekday;
    }


    //
    // TRANSACTIONS
    //

    // The concept of sending tokens to or from the org
    struct Transaction {
        address token;
        int value;
        address baseToken;
        int baseValue;
        address externalAddress;
        string reference;
        uint timestamp;
        uint accountingPeriodId;  // in which accounting period did this occur
    }    

    // The state a transaction update can be.
    // New states should be added to the end to maintain the 
    // order of the index when interfacing with web3.
    enum TransactionState {
        New, // not needed?
        PendingApproval,
        Failed,
        Succeeded
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

    // Reverse relation of a Transaction ID  -> TransactionsUpdatesIds[]
    // transactionUpdatesRelation[tid] = [tuid_0..tuid_N]
    mapping (uint => uint[]) public transactionUpdatesRelation;

    // Create a new transaction and return the id of the new transaction.
    // externalAddress is where the transication is coming or going to.
    bytes4 constant NEW_TRANSACTION_SID = bytes4(sha3('newTransaction(address,int,address,string,TransactionState)'));
    function newTransaction(address token, int value, address externalAddress, string reference, TransactionState initialState) returns (uint) {

        uint tid = transactions.push(Transaction({
            externalAddress: externalAddress, 
            token: token, 
            value: value, 
            // TODO: get base token and exchange rate from oracle 
            baseToken: 0x0, 
            baseValue: 1,
            reference: reference, 
            timestamp: now,
            accountingPeriodId: getCurrentAccountingPeriodId()
        })) - 1;
        // All transactions must have at least one state.
        // To optimize, incoming transactions could go directly to "Suceeded" or "Failed".
        updateTransaction(tid, initialState, "new");
        return tid;
    }


    // Create new transactionUpdate for the given transaction id
    bytes4 constant UPDATE_TRANSACTION_SIG = bytes4(sha3('updateTransaction(uint,TransactionState,string)'));
    function updateTransaction(uint transactionId, TransactionState state, string reason) returns (uint) {
        uint tuid = transactionUpdates.push(TransactionUpdate({
            transactionId: transactionId,
            state: state,
            reason: reason,
            actor: msg.sender
        })) - 1;
        transactionUpdatesRelation[transactionId].push(tuid);
        return tuid;
    }

    bytes4 constant SET_TRANSACTION_SUCCEEDED_SIG = bytes4(sha3('setTransactionSucceeded(uint,string)'));
    function setTransactionSucceeded(uint transactionId, string reason) {
        updateTransaction(transactionId, TransactionState.Succeeded, reason);
    }    

    bytes4 constant SET_TRANSACTION_PENDING_APPROVAL_SIG = bytes4(sha3('setTransactionPendingApproval(uint,string)'));
    function setTransactionPendingApproval(uint transactionId, string reason) {
        updateTransaction(transactionId, TransactionState.PendingApproval, reason);
    }

    bytes4 constant SET_TRANSACTION_FAILED_SIG = bytes4(sha3('setTransactionFailed(uint,string)'));
    function setTransactionFailed(uint transactionId, string reason) {
        updateTransaction(transactionId, TransactionState.Failed, reason);
    }

    // This flattens the last TransactionUpdate with the base Transation to show the current state of the transaction.
    // This assumes that there is at least a single transaction update which is fine if newTransaction is used.
    bytes4 constant GET_TRANSACTION_STATE_SIG = bytes4(sha3('getTransactionState(uint)'));
    function getTransactionState(uint transactionId) constant returns (address token, int value, string reference, uint timestamp, string stringState, TransactionState state, uint accountingPeriodId) {
        Transaction t = transactions[transactionId];
        uint lastTransactionUpdate = transactionUpdatesRelation[transactionId][transactionUpdatesRelation[transactionId].length - 1];
        TransactionUpdate tu = transactionUpdates[lastTransactionUpdate];
        token = t.token;
        value = t.value;
        reference = t.reference;
        timestamp = t.timestamp;
        state = tu.state;
        accountingPeriodId = t.accountingPeriodId;
        if (state == TransactionState.Succeeded) {
            stringState = "Succeeded";
        } else if (state == TransactionState.New) {
            stringState = "New";
        } else if (state == TransactionState.PendingApproval) {
            stringState = "PendingApproval";
        } else if (state == TransactionState.Failed) 
            stringState = "Failed";
    }


    function canHandlePayload(bytes payload) constant returns (bool) {
        bytes4 sig = getSig(payload);
        return (
            sig == SET_TRANSACTION_SUCCEEDED_SIG || 
            sig == SET_TRANSACTION_PENDING_APPROVAL_SIG || 
            sig == SET_TRANSACTION_FAILED_SIG || 
            sig == GET_TRANSACTION_STATE_SIG
        );
    }
    function AccountingApp(address _dao) Application(_dao) {
        // Should setup be an explicit step?
        setDefaultAccountingPeriodSettings(0x111, '0', '*', '*', '0'); // 5  new accounting period every sunday at midnight
        startNextAccountingPeriod();
    }
}