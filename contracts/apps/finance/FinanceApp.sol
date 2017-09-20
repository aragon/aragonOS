pragma solidity 0.4.15;

import "../App.sol";

import "../vault/Vault.sol";

import "zeppelin-solidity/contracts/token/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract FinanceApp is App, Initializable {
    using SafeMath for uint256;

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

        mapping (address => TokenStatement) tokenStatement;
    }

    struct Settings {
        uint64 periodDuration;
        ERC20[] budgetTokens;
        uint256[] budgetAmounts;
    }

    Vault vault;

    Payment[] public payments;
    Transaction[] public transactions;
    Period[] periods;
    Settings settings;

    uint64 constant public MAX_BUDGET_TOKENS = 25;
    uint64 constant public MAX_PAYMENTS_PER_TX = 20;
    uint64 constant public MAX_UINT64 = uint64(-1);

    event NewPeriod(uint256 indexed periodId, uint64 periodStarts, uint64 periodEnds);
    event SetBudget(address indexed token, uint256 amount);
    event NewPayment(uint256 indexed paymentId, address recipient, uint64 maxRepeats);
    event NewTransaction(uint256 transactionId, bool incoming, address indexed entity);

    function initialize(Vault _vault, uint64 _periodDuration) onlyInit {
        initialized();

        vault = _vault;

        payments.length += 1;
        payments[0].disabled = true;

        settings.periodDuration = _periodDuration;
        _createPeriod(uint64(getTimestamp()));
    }

    function _createPeriod(uint64 _startTime) internal returns (Period storage) {
        uint256 newPeriodId = periods.length++;

        Period storage period = periods[newPeriodId];
        period.startTime = _startTime;
        period.endTime = _startTime + settings.periodDuration;

        NewPeriod(newPeriodId, period.startTime, period.endTime);

        return period;
    }

    modifier transitionsPeriod {
        tryTransitionAccountingPeriod();
        _;
    }

    function tryTransitionAccountingPeriod() {
        Period storage currentPeriod = periods[currentPeriodId()];
        if (getTimestamp() <= currentPeriod.endTime) return;

        Period storage newPeriod = _createPeriod(currentPeriod.endTime);

        // In case multiple periods have to be transitioned at once
        if (getTimestamp() > newPeriod.endTime) {
            tryTransitionAccountingPeriod();
            return;
        }

        vault.requestAllowances(settings.budgetTokens, settings.budgetAmounts);
    }

    function setPeriodDuration(uint64 _duration) auth transitionsPeriod external {
        settings.periodDuration = _duration;
    }

    function setBudget(ERC20 _token, uint256 _amount) auth transitionsPeriod external {
        bool budgetExisted = false;
        // If budget is already set, update value
        for (uint256 i = 0; i < settings.budgetTokens.length; i++) {
            if (settings.budgetTokens[i] == _token) {
                if (_amount > 0) {
                    settings.budgetAmounts[i] = _amount;
                } else {
                    // if setting budget to 0, remove from lists
                    uint256 lastItem = settings.budgetTokens.length - 1;
                    if (i < lastItem) {
                        settings.budgetTokens[i] = settings.budgetTokens[lastItem];
                        settings.budgetAmounts[i] = settings.budgetAmounts[lastItem];
                    }
                    settings.budgetAmounts.length -= 1;
                    settings.budgetTokens.length -= 1;
                }
                budgetExisted = true;
                break;
            }
        }

        if (!budgetExisted) {
            // Add new token budget
            require(settings.budgetTokens.length < MAX_BUDGET_TOKENS);
            require(_amount > 0);
            settings.budgetTokens.push(_token);
            settings.budgetAmounts.push(_amount);
        }

        Period storage currentPeriod = periods[currentPeriodId()];
        uint256 periodExpense = currentPeriod.tokenStatement[_token].expenses;
        uint256 newBudget = periodExpense < _amount ? _amount.sub(periodExpense) : 0;

        vault.requestAllowance(_token, newBudget);

        SetBudget(_token, _amount);

        assert(settings.budgetAmounts.length == settings.budgetTokens.length);
    }

    function getSettings() constant returns (uint64 periodDuration, uint256 budgetLength) {
        return (settings.periodDuration, settings.budgetTokens.length);
    }

    function getBudget(uint256 _budgetId) transitionsPeriod constant returns (ERC20 token, uint256 budget, uint256 remainingBudget) {
        token = ERC20(settings.budgetTokens[_budgetId]);
        budget = settings.budgetAmounts[_budgetId];
        remainingBudget = token.allowance(address(vault), address(this));
    }

    function currentPeriodId() constant returns (uint256) {
        return periods.length - 1;
    }

    function newPayment(
        ERC20 _token,
        address _receiver,
        uint256 _amount,
        uint64 _initialPaymentTime,
        uint64 _interval,
        uint64 _maxRepeats,
        string _reference
    ) auth transitionsPeriod external returns (uint256 paymentId) {
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

    function executePayment(uint256 _paymentId) auth external {
        require(nextPaymentTime(_paymentId) <= getTimestamp());

        _executePayment(_paymentId);
    }

    function receiverExecutePayment(uint256 _paymentId) external {
        require(nextPaymentTime(_paymentId) <= getTimestamp());
        require(payments[_paymentId].receiver == msg.sender);

        _executePayment(_paymentId);
    }

    function setPaymentDisabled(uint256 _paymentId, bool _disabled) auth external {
        payments[_paymentId].disabled = _disabled;
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

    function deposit(ERC20 _token, uint256 _amount) transitionsPeriod {
        _recordTransaction(true, _token, msg.sender, _amount, 0);

        require(_token.transferFrom(msg.sender, address(vault), _amount));
    }

    function _makePaymentTransaction(ERC20 _token, address _receiver, uint256 _amount, uint256 _paymentId) internal {
        _recordTransaction(false, _token, _receiver, _amount, _paymentId);

        require(_token.transferFrom(address(vault), _receiver, _amount));
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

        NewTransaction(transactionId, _incoming, _entity);
    }

    function _canMakePayment(ERC20 _token, uint256 _amount) internal returns (bool) {
        return _token.allowance(address(vault), address(this)) >= _amount &&
            _token.balanceOf(address(vault)) >= _amount;
    }

    function nextPaymentTime(uint256 _paymentId) constant returns (uint64) {
        Payment memory payment = payments[_paymentId];

        if (payment.repeats >= payment.maxRepeats) return MAX_UINT64;

        return uint64(uint256(payment.initialPaymentTime).add(uint256(payment.repeats).mul(uint256(payment.interval))));
    }

    function getTimestamp() internal constant returns (uint256) { return now; }
}
