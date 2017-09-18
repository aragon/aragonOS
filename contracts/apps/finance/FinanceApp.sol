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

    Payment[] payments;
    Transaction[] transactions;
    Period[] periods;
    Settings settings;

    uint64 constant MAX_BUDGET_TOKENS = 25;
    uint64 constant MAX_PAYMENTS_PER_TX = 20;
    uint64 constant MAX_UINT64 = uint64(-1);

    function initialize(Vault _vault) onlyInit {
        vault = _vault;

        payments.length += 1;
        payments[0].disabled = true;
    }

    modifier transitionsPeriod {
        tryTransitionAccountingPeriod();
        _;
    }

    function tryTransitionAccountingPeriod() {
        Period storage currentPeriod = periods[currentPeriodId()];
        if (getTimestamp() <= currentPeriod.endTime) return;

        uint256 newPeriodId = periods.length++;
        Period storage newPeriod = periods[newPeriodId];

        newPeriod.startTime = currentPeriod.endTime;
        newPeriod.endTime = currentPeriod.endTime + settings.periodDuration;

        vault.requestAllowances(settings.budgetTokens, settings.budgetAmounts);
        _removeEmptyBudgets();
    }

    function _removeEmptyBudgets() {
        uint256 i = 0;
        while (i < settings.budgetTokens.length) {
            if (settings.budgetAmounts[i] == 0) {
                uint256 last = settings.budgetTokens.length - 1;
                if (i != last) {
                    settings.budgetTokens[i] = settings.budgetTokens[last];
                    settings.budgetAmounts[i] = settings.budgetAmounts[i];
                }

                settings.budgetTokens.length--;
                settings.budgetAmounts.length--;
            } else {
                i++;
            }
        }
    }

    function setPeriodDuration(uint64 _duration) auth transitionsPeriod external {
        settings.periodDuration = _duration;
    }

    function setBudget(ERC20 _token, uint256 _amount) auth transitionsPeriod external {
        for (uint256 i = 0; i < settings.budgetTokens.length; i++) {
            if (settings.budgetTokens[i] == _token) {
                settings.budgetAmounts[i] = _amount;
                return;
            }
        }

        require(settings.budgetTokens.length < MAX_BUDGET_TOKENS);
        settings.budgetTokens.push(_token);
        settings.budgetAmounts.push(_amount);
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

    function _executePayment(uint256 _paymentId) transitionsPeriod internal {
        Payment storage payment = payments[_paymentId];
        require(!payment.disabled);

        uint64 payed = 0;
        while (nextPaymentTime(_paymentId) <= getTimestamp() && payed < MAX_PAYMENTS_PER_TX) {
            if (!_canMakePayment(payment.token, payment.amount)) return;
            payment.repeats += 1;
            payed += 1;
            _makePaymentTransaction(payment.token, payment.receiver, payment.amount, _paymentId);
        }
    }

    function deposit(ERC20 _token, uint256 _amount) {
        _recordTransaction(true, _token, msg.sender, _amount, 0);

        assert(_token.transferFrom(msg.sender, address(vault), _amount));
    }

    function _makePaymentTransaction(ERC20 _token, address _receiver, uint256 _amount, uint256 _paymentId) internal {
        _recordTransaction(false, _token, _receiver, _amount, _paymentId);

        assert(_token.transferFrom(address(vault), _receiver, _amount));
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

    event NewTransaction(uint256 transactionId, bool incoming, address indexed entity);

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
