pragma solidity ^0.4.24;

import "./IRelayer.sol";
import "./RelayedAragonApp.sol";
import "../lib/sig/ECDSA.sol";
import "../lib/misc/EIP712.sol";
import "../lib/math/SafeMath.sol";
import "../apps/AragonApp.sol";
import "../common/MemoryHelpers.sol";
import "../common/DepositableStorage.sol";


contract Relayer is IRelayer, AragonApp, DepositableStorage, EIP712 {
    using ECDSA for bytes32;
    using SafeMath for uint256;
    using MemoryHelpers for bytes;

    string private constant ERROR_GAS_REFUND_FAIL = "RELAYER_GAS_REFUND_FAIL";
    string private constant ERROR_GAS_QUOTA_EXCEEDED = "RELAYER_GAS_QUOTA_EXCEEDED";
    string private constant ERROR_SENDER_NOT_ALLOWED = "RELAYER_SENDER_NOT_ALLOWED";
    string private constant ERROR_NONCE_ALREADY_USED = "RELAYER_NONCE_ALREADY_USED";
    string private constant ERROR_SERVICE_NOT_ALLOWED = "RELAYER_SERVICE_NOT_ALLOWED";
    string private constant ERROR_INVALID_SENDER_SIGNATURE = "RELAYER_INVALID_SENDER_SIGNATURE";

    // Constant values used to identify the domain for the current app following EIP 712 spec
    string private constant EIP_712_DOMAIN_NAME = "Aragon Relayer";
    string private constant EIP_712_DOMAIN_VERSION = "1";
    uint256 private constant EIP_712_DOMAIN_CHAIN_ID = 1;

    // Type hash used to validate signatures based on EIP-712
    bytes32 public constant TRANSACTION_TYPE = keccak256("Transaction(address to,uint256 nonce,bytes data,uint256 gasRefund,uint256 gasPrice)");

    // ACL role used to validate who is able to add a new senders to use the relay service
    bytes32 public constant ALLOW_SENDER_ROLE = keccak256("ALLOW_SENDER_ROLE");

    // ACL role used to validate who is able to remove already allowed senders to use the relay service
    bytes32 public constant DISALLOW_SENDER_ROLE = keccak256("DISALLOW_SENDER_ROLE");

    // ACL role used to validate who is able to add a new allowed off-chain services to relay transactions
    bytes32 public constant ALLOW_OFF_CHAIN_SERVICE_ROLE = keccak256("ALLOW_OFF_CHAIN_SERVICE_ROLE");

    // ACL role used to validate who is able to remove already allowed off-chain services to relay transactions
    bytes32 public constant DISALLOW_OFF_CHAIN_SERVICE_ROLE = keccak256("DISALLOW_OFF_CHAIN_SERVICE_ROLE");

    // ACL role used to validate who is able to change the refunds monthly quota
    bytes32 public constant SET_MONTHLY_REFUND_QUOTA_ROLE = keccak256("SET_MONTHLY_REFUND_QUOTA_ROLE");

    /**
     * @dev Event logged when a new address is added to the list of off-chain services allowed to relay transactions
     * @param service Address of the off-chain service allowed
     */
    event ServiceAllowed(address indexed service);

    /**
     * @dev Event logged when a an address is removed from the list of off-chain services allowed to relay transactions
     * @param service Address of the off-chain service disallowed
     */
    event ServiceDisallowed(address indexed service);

    /**
     * @dev Event logged when a new address is added to the list of allowed senders to use the relay service
     * @param sender Address of the sender sallowed to use the relayer service
     */
    event SenderAllowed(address indexed sender);

    /**
     * @dev Event logged when a an address is removed from the list of allowed senders to use the relay service
     * @param sender Address of the sender disallowed to use the relayer service
     */
    event SenderDisallowed(address indexed sender);

    /**
     * @dev Event logged when a new transaction is relayed successfully
     * @param from Address executed a transaction on behalf of
     * @param to Target address of the relayed transaction
     * @param nonce Nonce of the signer used for the relayed transaction
     * @param data Calldata included in the relayed transaction
     */
    event TransactionRelayed(address from, address to, uint256 nonce, bytes data);

    /**
     * @dev Event logged when the monthly refunds quota is changed
     * @param who Address of the account that change the monthly refunds quota
     * @param previousQuota Previous monthly refunds quota in ETH for each allowed sender
     * @param newQuota New monthly refunds quota in ETH for each allowed sender
     */
    event MonthlyRefundQuotaSet(address indexed who, uint256 previousQuota, uint256 newQuota);

    // Sender information carrying allowance, last nonce number used, and last active month related data
    struct Sender {
        bool allowed;
        uint256 lastUsedNonce;
        uint256 lastActiveMonth;
        uint256 lastActiveMonthRefunds;
    }

    // Timestamp to start counting monthly refunds quotas for each sender
    uint256 internal startDate;

    // Monthly refunds quota in ETH for each sender
    uint256 internal monthlyRefundQuota;

    // Mapping that indicates whether a given address is allowed as off-chain service to relay transactions
    mapping (address => bool) internal allowedServices;

    // Mapping from senders to their related information
    mapping (address => Sender) internal senders;

    // Check whether the msg.sender belongs to the list of allowed services to relay transactions
    modifier onlyAllowedServices() {
        require(_isServiceAllowed(msg.sender), ERROR_SERVICE_NOT_ALLOWED);
        _;
    }

    /**
     * @notice Initialize Relayer app setting a monthly refunds quota per address of `@tokenAmount(_monthlyRefundQuota, 0x00)`.
     * @param _monthlyRefundQuota Monthly refunds quota in ETH for each allowed sender
     */
    function initialize(uint256 _monthlyRefundQuota) external onlyInit {
        initialized();
        startDate = getTimestamp();
        monthlyRefundQuota = _monthlyRefundQuota;
        setDepositable(true);
    }

    /**
     * @notice Relay a transaction on behalf of `from` to target address `to`, with calldata `data`, using nonce #`nonce`, and requesting a refund of `@tokenAmount(gasRefund * gasPrice, 0x00)`.
     * @param from Address to execute a transaction on behalf of
     * @param to Target address that will receive the relayed transaction
     * @param nonce Nonce of the signer to be used to relay the requested transaction
     * @param data Calldata to be included in the relayed transaction
     * @param gasRefund Amount of gas to be refunded to the caller account
     * @param gasPrice Amount of ETH to pay for each gas unit that will be refunded to the caller account
     * @param signature Signature used to validate if all the given parameters were deliberated by actual signer
     */
    function relay(address from, address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice, bytes signature)
        external
        onlyAllowedServices
    {
        Sender storage sender = senders[from];
        uint256 currentMonth = _getCurrentMonth();
        uint256 requestedRefund = gasRefund.mul(gasPrice);

        require(_isSenderAllowed(sender), ERROR_SENDER_NOT_ALLOWED);
        require(_canUseNonce(sender, nonce), ERROR_NONCE_ALREADY_USED);
        require(_canRefund(sender, currentMonth, requestedRefund), ERROR_GAS_QUOTA_EXCEEDED);
        require(_isValidSignature(from, to, nonce, data, gasRefund, gasPrice, signature), ERROR_INVALID_SENDER_SIGNATURE);

        _updateSenderInfo(sender, nonce, currentMonth, requestedRefund);
        _relayCall(from, to, data);
        emit TransactionRelayed(from, to, nonce, data);

        /* solium-disable security/no-send */
        require(msg.sender.send(requestedRefund), ERROR_GAS_REFUND_FAIL);
    }

    /**
     * @notice Add a new service `service` to the list of off-chain services allowed to relay transactions.
     * @param service Address of the off-chain service to be allowed
     */
    function allowService(address service) external authP(ALLOW_OFF_CHAIN_SERVICE_ROLE, arr(service)) {
        allowedServices[service] = true;
        emit ServiceAllowed(service);
    }

    /**
     * @notice Remove service `service` from the list of off-chain services allowed to relay transactions.
     * @param service Address of the off-chain service to be disallowed
     */
    function disallowService(address service) external authP(DISALLOW_OFF_CHAIN_SERVICE_ROLE, arr(service)) {
        allowedServices[service] = false;
        emit ServiceDisallowed(service);
    }

    /**
     * @notice Add a new sender `sender` to the list of allowed addresses that can use the relay service
     * @param senderAddress Address of the sender to be allowed
     */
    function allowSender(address senderAddress) external authP(ALLOW_SENDER_ROLE, arr(senderAddress)) {
        senders[senderAddress].allowed = true;
        emit SenderAllowed(senderAddress);
    }

    /**
     * @notice Remove sender `sender` from the list of allowed addresses that can use the relay service
     * @param senderAddress Address of the sender to be disallowed
     */
    function disallowSender(address senderAddress) external authP(DISALLOW_SENDER_ROLE, arr(senderAddress)) {
        senders[senderAddress].allowed = false;
        emit SenderDisallowed(senderAddress);
    }

    /**
     * @notice Set new monthly refunds quota per address of `@tokenAmount(newQuota, 0x00)`.
     * @param newQuota New monthly refunds quota in ETH for each allowed sender
     */
    function setMonthlyRefundQuota(uint256 newQuota) external authP(SET_MONTHLY_REFUND_QUOTA_ROLE, arr(newQuota)) {
        emit MonthlyRefundQuotaSet(msg.sender, monthlyRefundQuota, newQuota);
        monthlyRefundQuota = newQuota;
    }

    /**
     * @notice Return the information related to a given sender `sender`.
     * @return The information for the requested sender
     */
    function getSender(address senderAddress) external view isInitialized
        returns (bool allowed, uint256 lastUsedNonce, uint256 lastActiveMonth, uint256 lastActiveMonthRefunds)
    {
        Sender storage sender = senders[senderAddress];
        allowed = sender.allowed;
        lastUsedNonce = sender.lastUsedNonce;
        lastActiveMonth = sender.lastActiveMonth;
        lastActiveMonthRefunds = sender.lastActiveMonthRefunds;
    }

    /**
     * @notice Return the start date timestamp used to count the monthly refunds quotas for each sender.
     * @return The start date timestamp used to count the monthly refunds quotas for each sender
     */
    function getStartDate() external view isInitialized returns (uint256) {
        return startDate;
    }

    /**
     * @notice Return the monthly refunds quotas for each sender.
     * @return The monthly refunds quotas for each sender
     */
    function getMonthlyRefundQuota() external view isInitialized returns (uint256) {
        return monthlyRefundQuota;
    }

    /**
     * @notice Return the amount of months since the Relayer app was created.
     * @return The amount of months since the Relayer app was created
     */
    function getCurrentMonth() external view isInitialized returns (uint256) {
        return _getCurrentMonth();
    }

    /**
     * @notice Tell if a given service `service` is allowed to relay transactions through the Relayer app.
     * @return True if the given service is allowed to relay transactions through the app
     */
    function isServiceAllowed(address service) external view isInitialized returns (bool) {
        return _isServiceAllowed(service);
    }

    /**
     * @notice Tell if a given sender `sender` is allowed to use the relay service.
     * @return True if the given sender is allowed to use the relay service
     */
    function isSenderAllowed(address senderAddress) external view isInitialized returns (bool) {
        return _isSenderAllowed(senders[senderAddress]);
    }

    /**
     * @notice Tell if a given sender `sender` can use the nonce number `nonce` to relay a new transaction.
     * @return True if the given sender can use the given nonce number to relay a new transaction
     */
    function canUseNonce(address senderAddress, uint256 nonce) external view isInitialized returns (bool) {
        return _canUseNonce(senders[senderAddress], nonce);
    }

    /**
     * @notice Tell if a given sender `sender` can relay a new transaction spending `@tokenAmount(newQuota, 0x00)` in month `month`.
     * @return True if the given sender can relay a new transaction spending the given amount for the given month
     */
    function canRefund(address senderAddress, uint256 amount) external view isInitialized returns (bool) {
        uint256 currentMonth = _getCurrentMonth();
        return _canRefund(senders[senderAddress], currentMonth, amount);
    }

    /**
     * @notice Tell if the current app allows to recover amount of `token` from the Relayer app.
     * @param token Token address that would be recovered
     * @return True if the given address is not ETH
     */
    function allowRecoverability(address token) public view returns (bool) {
        // does not allow to recover ETH
        return token != ETH;
    }

    function _getCurrentMonth() internal view returns (uint256) {
        uint256 passedSeconds = getTimestamp().sub(startDate);
        return passedSeconds / 30 days;
    }

    function _isServiceAllowed(address service) internal view returns (bool) {
        return allowedServices[service];
    }

    function _isSenderAllowed(Sender storage sender) internal view returns (bool) {
        return sender.allowed;
    }

    function _canUseNonce(Sender storage sender, uint256 nonce) internal view returns (bool) {
        return sender.lastUsedNonce < nonce;
    }

    function _canRefund(Sender storage sender, uint256 currentMonth, uint256 amount) internal view returns (bool) {
        if (currentMonth == sender.lastActiveMonth) {
            return sender.lastActiveMonthRefunds.add(amount) <= monthlyRefundQuota;
        }
        return currentMonth > sender.lastActiveMonth;
    }

    function _isValidSignature(address sender, address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice, bytes signature)
        internal
        view
        returns (bool)
    {
        bytes32 messageHash = _messageHash(to, nonce, data, gasRefund, gasPrice);
        address signer = messageHash.recover(signature);
        return sender == signer;
    }

    function _messageHash(address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice) internal view returns (bytes32) {
        bytes32 hash = keccak256(abi.encode(TRANSACTION_TYPE, to, nonce, keccak256(data), gasRefund, gasPrice));
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), hash));
    }

    function _relayCall(address from, address to, bytes data) internal {
        bytes memory encodedSignerData = data.append(from);
        assembly {
            let success := call(gas, to, 0, add(encodedSignerData, 0x20), mload(encodedSignerData), 0, 0)
            switch success case 0 {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize)
                revert(ptr, returndatasize)
            }
        }
    }

    function _updateSenderInfo(Sender storage sender, uint256 nonce, uint256 month, uint256 refund) internal {
        sender.lastUsedNonce = nonce;
        if (sender.lastActiveMonth != month) {
            sender.lastActiveMonth = month;
            sender.lastActiveMonthRefunds = refund;
        } else {
            sender.lastActiveMonthRefunds = sender.lastActiveMonthRefunds.add(refund);
        }
    }

    function _domainName() internal view returns (string) {
        return EIP_712_DOMAIN_NAME;
    }

    function _domainVersion() internal view returns (string) {
        return EIP_712_DOMAIN_VERSION;
    }

    function _domainChainId() internal view returns (uint256) {
        return EIP_712_DOMAIN_CHAIN_ID;
    }
}
