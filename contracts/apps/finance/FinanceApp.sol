pragma solidity 0.4.15;

import "../App.sol";
import "../../common/Initializable.sol";

import "../vault/Vault.sol";

import "../../zeppelin/token/ERC20.sol";
import "../../zeppelin/math/SafeMath.sol";

contract FinanceApp is App, Initializable {
    using SafeMath for uint256;

    Vault vault;

    uint64 constant public MAX_BUDGET_TOKENS = 25;
    uint64 constant public MAX_PAYMENTS_PER_TX = 20;
    uint64 constant public MAX_UINT64 = uint64(-1);

    bytes32 constant public PAYMENT_CREATOR_ROLE = bytes32(1);
    bytes32 constant public CHANGE_SETTINGS_ROLE = bytes32(2);
    bytes32 constant public EXECUTE_PAYMENTS_ROLE = bytes32(3);
    bytes32 constant public DISABLE_PAYMENT_ROLE = bytes32(4);

    struct Payment {
        ERC20 token;
        address receiver;
        uint64 initialPaymentTime;
        uint64 interval;
        uint64 maxRepeats;
        uint64 repeats;
        uint256 amount;
        bool disabled;
        string reference;
        address createdBy;
    }

    struct Transaction {
        uint256 periodId;
        uint256 amount;
        uint256 paymentId;
        ERC20 token;
        address entity;
        bool isIncoming;
        uint64 date;
    }

    struct TokenStatement {
        uint256 expenses;
        uint256 income;
    }

    struct Period {
        uint64 startTime;
        uint64 endTime;
        uint256 firstTransactionId;
        uint256 lastTransactionId;

        mapping (address => TokenStatement) tokenStatement;
    }

    struct Settings {
        uint64 periodDuration;
        mapping (address => uint256) budgets;
    }

    Payment[] public payments; // first index is 1
    Transaction[] public transactions; // first index is 1
    Period[] public periods; // first index is 0
    Settings settings;

    event NewPeriod(uint256 indexed periodId, uint64 periodStarts, uint64 periodEnds);
    event SetBudget(address indexed token, uint256 amount);
    event NewPayment(uint256 indexed paymentId, address recipient, uint64 maxRepeats);
    event NewTransaction(uint256 transactionId, bool incoming, address indexed entity);

    // Modifier used by all methods that impact accounting to make sure accounting period
    // is changed before the operation if needed
    modifier transitionsPeriod {
        tryTransitionAccountingPeriod();
        _;
    }

    /**
    * @notice Initialize Finance app for `_vault` with duration `_periodDuration`
    * @param _vault Address of the vault Finance will rely on (non changeable)
    * @param _periodDuration Duration in seconds of each period
    */
    function initialize(Vault _vault, uint64 _periodDuration) onlyInit {
        initialized();

        vault = _vault;

        payments.length += 1;
        payments[0].disabled = true;

        transactions.length += 1;

        settings.periodDuration = _periodDuration;
        _newPeriod(uint64(getTimestamp()));
    }

    function deposit(ERC20 _token, uint256 _amount) transitionsPeriod {
        _recordTransaction(true, _token, msg.sender, _amount, 0);

        require(_token.transferFrom(msg.sender, address(vault), _amount));
    }

    function newPayment(
        ERC20 _token,
        address _receiver,
        uint256 _amount,
        uint64 _initialPaymentTime,
        uint64 _interval,
        uint64 _maxRepeats,
        string _reference
    ) auth(PAYMENT_CREATOR_ROLE) transitionsPeriod external returns (uint256 paymentId) {
        paymentId = payments.length++;

        Payment storage payment = payments[paymentId];
        payment.token = _token;
        payment.receiver = _receiver;
        payment.amount = _amount;
        payment.initialPaymentTime = _initialPaymentTime;
        payment.interval = _interval;
        payment.maxRepeats = _maxRepeats;
        payment.reference = _reference;
        payment.createdBy = msg.sender;

        NewPayment(paymentId, _receiver, _maxRepeats);

        if (nextPaymentTime(paymentId) <= getTimestamp())
            _executePayment(paymentId);
    }

    function setPeriodDuration(uint64 _duration) auth(CHANGE_SETTINGS_ROLE) transitionsPeriod external {
        settings.periodDuration = _duration;
    }

    function setBudget(ERC20 _token, uint256 _amount) auth(CHANGE_SETTINGS_ROLE) transitionsPeriod external {
        settings.budgets[address(_token)] = _amount;
        SetBudget(_token, _amount);
    }

    function executePayment(uint256 _paymentId) auth(EXECUTE_PAYMENTS_ROLE) external {
        require(nextPaymentTime(_paymentId) <= getTimestamp());

        _executePayment(_paymentId);
    }

    function receiverExecutePayment(uint256 _paymentId) external {
        require(nextPaymentTime(_paymentId) <= getTimestamp());
        require(payments[_paymentId].receiver == msg.sender);

        _executePayment(_paymentId);
    }

    function setPaymentDisabled(uint256 _paymentId, bool _disabled) auth(DISABLE_PAYMENT_ROLE) external {
        payments[_paymentId].disabled = _disabled;
    }

    function tryTransitionAccountingPeriod() {
        Period storage currentPeriod = periods[currentPeriodId()];
        if (getTimestamp() <= currentPeriod.endTime) return;
        if (currentPeriod.firstTransactionId != 0)
            currentPeriod.lastTransactionId = transactions.length - 1;

        Period storage newPeriod = _newPeriod(currentPeriod.endTime);

        // In case multiple periods have to be transitioned at once
        if (getTimestamp() > newPeriod.endTime) {
            tryTransitionAccountingPeriod();
            return;
        }
    }

    // consts

    function nextPaymentTime(uint256 _paymentId) constant returns (uint64) {
        Payment memory payment = payments[_paymentId];

        if (payment.repeats >= payment.maxRepeats) return MAX_UINT64;

        return uint64(uint256(payment.initialPaymentTime).add(uint256(payment.repeats).mul(uint256(payment.interval))));
    }

    function getPeriodDuration() constant returns (uint64 periodDuration) {
        return settings.periodDuration;
    }

    function getBudget(address _token) transitionsPeriod constant returns (uint256 budget, uint256 remainingBudget) {
        budget = settings.budgets[_token];
        remainingBudget = _getRemainingBudget(_token);
    }

    function currentPeriodId() constant returns (uint256) {
        return periods.length - 1;
    }

    // internal fns

    function _newPeriod(uint64 _startTime) internal returns (Period storage) {
        uint256 newPeriodId = periods.length++;

        Period storage period = periods[newPeriodId];
        period.startTime = _startTime;
        period.endTime = _startTime + settings.periodDuration;

        NewPeriod(newPeriodId, period.startTime, period.endTime);

        return period;
    }

    function _executePayment(uint256 _paymentId) transitionsPeriod internal returns (bool) {
        Payment storage payment = payments[_paymentId];
        require(!payment.disabled);

        uint64 payed = 0;
        while (nextPaymentTime(_paymentId) <= getTimestamp() && payed < MAX_PAYMENTS_PER_TX) {
            if (!_canMakePayment(payment.token, payment.amount)) break;
            payment.repeats += 1;
            payed += 1;
            _makePaymentTransaction(payment.token, payment.receiver, payment.amount, _paymentId);
        }

        return payed > 0;
    }

    function _makePaymentTransaction(ERC20 _token, address _receiver, uint256 _amount, uint256 _paymentId) internal {
        _recordTransaction(false, _token, _receiver, _amount, _paymentId);
        TokenStatement storage tokenStatement = periods[currentPeriodId()].tokenStatement[_token];
        require(tokenStatement.expenses <= settings.budgets[_token]); // check it didn't go over-budget

        vault.transferTokens(_token, _receiver, _amount);
    }

    function _recordTransaction(bool _incoming, ERC20 _token, address _entity, uint256 _amount, uint256 _paymentId) internal {
        uint256 periodId = currentPeriodId();
        TokenStatement storage tokenStatement = periods[periodId].tokenStatement[_token];
        if (_incoming) {
            tokenStatement.income = tokenStatement.income.add(_amount);
        } else {
            tokenStatement.expenses = tokenStatement.expenses.add(_amount);
        }

        uint256 transactionId = transactions.length++;
        Transaction storage transaction = transactions[transactionId];
        transaction.periodId = periodId;
        transaction.amount = _amount;
        transaction.paymentId = _paymentId;
        transaction.isIncoming = _incoming;
        transaction.token = _token;
        transaction.entity = _entity;

        Period storage period = periods[periodId];
        if (period.firstTransactionId == 0) period.firstTransactionId = transactionId;

        NewTransaction(transactionId, _incoming, _entity);
    }

    function _canMakePayment(ERC20 _token, uint256 _amount) internal returns (bool) {
        return _getRemainingBudget(_token) >= _amount &&
            _token.balanceOf(address(vault)) >= _amount;
    }

    function _getRemainingBudget(address _token) internal constant returns (uint256) {
        uint256 spent = periods[currentPeriodId()].tokenStatement[_token].expenses;
        return settings.budgets[_token].sub(spent);
    }

    function getTimestamp() internal constant returns (uint256) { return now; }
}
