pragma solidity ^0.4.15;

import "../App.sol";
import "../../common/Initializable.sol";
import "zeppelin-solidity/contracts/token/ERC20.sol";
import "../vault/Vault.sol";
import "../../misc/Crontab.sol";


contract FinanceApp is App, Initializable, Crontab {

    Vault vault;

    struct AccountingPeriod {

        bytes2 ct_sec;
        bytes2 ct_min;
        bytes2 ct_hour;
        bytes2 ct_day;
        bytes2 ct_month;
        bytes2 ct_weekday;
        bytes2 ct_year;
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
        uint timestamp;
        string reference;
        uint accountingPeriodId;  // in which accounting period did this occur
        TransactionType _type;
    }

    enum TransactionType {
        Deposit,
        Withdrawal
    }

    struct Payment {
        ERC20 token;
        uint amount;
        address to;
        uint repeat; // number of times this can be paid
        uint timesCalled; //
        uint startTimestamp; // Initial timestamp 
        uint nextTimestamp; 
        bool canceled; // override to cancel a payment
        bytes2 ct_sec;
        bytes2 ct_min;
        bytes2 ct_hour;
        bytes2 ct_day;
        bytes2 ct_month;
        bytes2 ct_weekday;
        bytes2 ct_year;
    }

    Payment[] payments;



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
        address actor; // who performed this update
    }

    Transaction[] public transactions;
    TransactionUpdate[] public transactionUpdates;

    // Reverse relation of a Transaction ID  -> TransactionsUpdatesIds[]
    // transactionUpdatesRelation[tid] = [tuid_0..tuid_N]
    mapping (uint => uint[]) public transactionUpdatesRelation;

    event WithdrawalFailed(uint transactionId);

    function () {
    }

    function FinanceApp() {
    }

    /**
    * @param vaultAddress The vault app to use with this FinanceApp
    */
    function initialize(address vaultAddress) onlyInit {
        initialized();
        vault = Vault(vaultAddress);
    }

    event NewPayment(uint pid);
    /**
    * @notice This will a create a new payment
    * @param token The token that will be paid
    * @param amount The amount to be paid 
    * @param repeat This is the number of times that the payment should be sent 1..n times
    * @param startTimestamp This is when the payments will begin
    */
    function newPayment(ERC20 token, uint amount, address to, uint repeat, uint startTimestamp, bytes2 ct_sec, bytes2 ct_min, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday, bytes2 ct_year) auth external {
        require(repeat > 0);
        uint pid = _newPayment(token, amount, to, startTimestamp);
        _setPaymentSchedual(pid, repeat, ct_sec, ct_min, ct_hour, ct_day, ct_month, ct_weekday, ct_year);
        NewPayment(pid);
    }

    /**
    * @dev Internal newPament creation
    */
    function _newPayment(ERC20 token, uint amount, address to, uint startTimestamp) internal returns (uint) {
        Payment memory p = Payment( token, amount, to, 1, 0, startTimestamp, startTimestamp, false, "*", "*", "*", "*", "*", "*", "*");
        payments.push(p);
        uint pid = payments.length - 1;
        return  pid;
    }

    event UpdatedPayment(uint pid);
    /**
    * @dev Set the schedual of payments
    */
    function _setPaymentSchedual(uint pid, uint repeat, bytes2 ct_sec, bytes2 ct_min, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday, bytes2 ct_year) internal {
        Payment memory p = payments[pid];
        uint nextTimestamp = next(ct_sec, ct_min, ct_hour, ct_day, ct_month, ct_weekday, ct_year, p.startTimestamp);
        p.repeat = repeat;
        p.nextTimestamp = nextTimestamp;
        p.ct_sec = ct_sec;
        p.ct_min = ct_min;
        p.ct_hour = ct_hour;
        p.ct_day = ct_day;
        p.ct_month = ct_month;
        p.ct_weekday = ct_weekday;
        p.ct_year = ct_year;
        UpdatedPayment(pid);
    }

    /**
    * @dev Cancels the payment with the provided id
    * @param pid The id of the payment to cancel
    */
    function cancelPayment(uint pid) auth external {
        payments[pid].canceled = true;
    }

    /**
    * @dev Withdraw a payment if possible
    * @param pid The id of the payment to withdraw
    */
    function withdrawPayment(uint pid) auth external {
        Payment memory p = payments[pid];
        if ((p.to == msg.sender) && (p.timesCalled < p.repeat) && (!p.canceled) && (p.nextTimestamp < block.timestamp)) {
            uint tid = _newOutgoingTransaction(p.to, p.token, p.amount, "payment");
            p.nextTimestamp = next(p.ct_sec, p.ct_min, p.ct_hour, p.ct_day, p.ct_month, p.ct_weekday, p.ct_year, p.nextTimestamp);
            p.timesCalled += 1;
        }
    }

    /**
    * @return Returns the current accounting period id
    */
    function getCurrentAccountingPeriodId() public constant returns (uint) {
        // TODO: perhaps we should store the current accountingPeriod ID
        // separately and allow accounting periods to be generated in advance.
        // For now the current period is the most recent one
        return accountingPeriods.length - 1;
    }

    /**
    * @dev This flattens the last TransactionUpdate with the base Transation to show the current state of the transaction.  This assumes that there is at least a single transaction update which is fine if newTransaction is used.
    * @param transactionId The id of the transaction 
    * @return The external addres, token address, amount, transaction type, and current transaction state
    */
    function getTransactionInfo(uint transactionId) constant returns (address, address, uint, TransactionType, TransactionState) {
        Transaction memory t = transactions[transactionId];
        uint tuid = transactionUpdatesRelation[transactionId].length - 1;
        uint lastTransactionUpdate = transactionUpdatesRelation[transactionId][tuid];
        TransactionUpdate memory tu = transactionUpdates[lastTransactionUpdate];
        return (t.externalAddress, t.token, t.amount, t._type, tu.state);
    }

    /**
    * @dev Get the current state of a transaction
    * @param transactionId The id of the transaction 
    * @return Returns uint of the transactionstate
    */
    function getTransactionState(uint transactionId) constant returns (TransactionState) {
        Transaction memory t = transactions[transactionId];
        uint tuid = transactionUpdatesRelation[transactionId].length - 1;
        uint lastTransactionUpdate = transactionUpdatesRelation[transactionId][tuid];
        TransactionUpdate memory tu = transactionUpdates[lastTransactionUpdate];
        return tu.state;
    }

    /**
    * @dev Internal function to start the next accounting period
    */
    function _startNextAccountingPeriod() internal {
        if(accountingPeriods.length == 0 || accountingPeriods[getCurrentAccountingPeriodId()].endTimestamp < now) {
            AccountingPeriod memory ap = defaultAccountingPeriodSettings;
            ap.startTimestamp = now;
            uint endTimestamp = next(ap.ct_sec, ap.ct_min, ap.ct_hour, ap.ct_day, ap.ct_month, ap.ct_weekday, ap.ct_year, now);
            ap.endTimestamp = endTimestamp;
            accountingPeriods.push(ap);
            vault.requestAllowances(ap.budgetTokens, ap.budgetAmounts);
        }
    }

    /**
    * @dev External authenticated function to start the next accounting period
    */
    function startNextAccountingPeriod() external auth {
        _startNextAccountingPeriod();
    }

    function _deposit(address tokenAddress, uint amount) internal {
        ERC20(tokenAddress).transferFrom(msg.sender, address(vault), amount);
        _newIncomingTransaction(msg.sender, tokenAddress, amount, "deposit");
    }

    /**
    * @dev External function to deposit tokens
    * @param tokenAddress The address of the token to deposit
    * @param amount Amount to deposit
    */

    function deposit(address tokenAddress, uint amount) external auth {
        _deposit(tokenAddress, amount);
    }

    function _setTokenBudget(address tokenAddress, uint amount) internal {
        // We cannot just remove a token when the amount is 0 because then it will remain with the available allowance forever.
        // TODO: add cleanup function to removes tokens that had a 0 budget the past two accounting periods
        var defaultAP = defaultAccountingPeriodSettings;
        assert(defaultAP.budgetTokens.length == defaultAP.budgetAmounts.length);
        for (uint i = 0; i < defaultAP.budgetTokens.length; i++) {
            // this is an existing token and we can about the amount
            if(address(defaultAP.budgetTokens[i]) == tokenAddress) {
                defaultAP.budgetAmounts[i] = amount;
                return; // early return
            }
        }
        // This means this is a new token, amount and needs to be appended
        defaultAP.budgetTokens.push(ERC20(tokenAddress));
        defaultAP.budgetAmounts.push(amount);
    }

    /**
    * @dev Public authed function to set the budget of a token
    * @param tokenAddress The address of the token to adjust
    * @param amount Amount to budget
    */
    function setTokenBudget(address tokenAddress, uint amount) auth external {
        _setTokenBudget(tokenAddress, amount);
    }

    /**
    * @dev Set ths settings for subsequent accounting periods
    */
    function setDefaultAccountingPeriodSettings(bytes2 ct_sec, bytes2 ct_min, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday, bytes2 ct_year) external auth {
        defaultAccountingPeriodSettings.ct_hour = ct_sec;
        defaultAccountingPeriodSettings.ct_hour = ct_min;
        defaultAccountingPeriodSettings.ct_hour = ct_hour;
        defaultAccountingPeriodSettings.ct_day = ct_day;
        defaultAccountingPeriodSettings.ct_month = ct_month;
        defaultAccountingPeriodSettings.ct_weekday = ct_weekday;
        defaultAccountingPeriodSettings.ct_year = ct_year;
    }

    function _newIncomingTransaction(address externalAddress, 
                                     address token, 
                                     uint256 amount, 
                                     string reference) internal 
                                     {
        _newTransaction(
            externalAddress, 
            token, 
            amount, 
            reference, 
            TransactionType.Deposit
        );
    }

    function _newOutgoingTransaction(
        address externalAddress, 
        address token, 
        uint256 amount, 
        string reference) internal returns (uint) 
        {
        uint tid = _newTransaction(
            externalAddress, 
            token, 
            amount, 
            reference, 
            TransactionType.Withdrawal
        );
        _updateTransaction(tid, TransactionState.Approved);
        _executeTransaction(tid);
        return tid;
    }

    /**
    * @dev Create a new transaction and return the id of the new transaction.
    * @param externalAddress where the transication is coming or going to.
    * @param token Address of the token being transfered
    * @param amount Amount being transfered
    * @param reference custom string to describe the transaction
    * @param _type 0 for deposit 1 for withdrawl
    * @return uint of the new transaction id
    */
    function _newTransaction(address externalAddress, 
                             address token, 
                             uint256 amount, 
                             string reference, 
                             TransactionType _type) internal returns (uint) 
         {
        _startNextAccountingPeriod();
        uint tid = transactions.push(
            Transaction({
                token: token,
                amount: amount,
                externalAddress: externalAddress,
                reference: reference,
                timestamp: now,
                accountingPeriodId: getCurrentAccountingPeriodId(),
                _type: _type
            })
        ) - 1;
        // All transactions must have at least one state.
        // To optimize, incoming transactions could go directly to "Suceeded" or "Failed".

        _updateTransaction(tid, TransactionState.New);
        return tid;
    }

    /**
    * @dev Function to actually transfer the tokens to external address
    */
    function _executeTransaction(uint transactionId) internal {
        Transaction memory t = transactions[transactionId];
        var (state, ) = getTransactionState(transactionId);
        require(state == TransactionState.Approved);
        bool succeeded = ERC20(t.token).transferFrom(address(vault), t.externalAddress, t.amount);
        if (succeeded) {
             _updateTransaction(transactionId, TransactionState.Succeeded);
        } else {
            _updateTransaction(transactionId, TransactionState.Failed);
        }
    }

    // Create new transactionUpdate for the given transaction id
    function _updateTransaction(uint transactionId, TransactionState state) internal {
        uint tuid = transactionUpdates.push(
            TransactionUpdate({
                transactionId: transactionId,
                state: state,
                actor: msg.sender
            })
        ) - 1;
        transactionUpdatesRelation[transactionId].push(tuid);
    }
}
