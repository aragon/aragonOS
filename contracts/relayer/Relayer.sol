pragma solidity ^0.4.24;

import "./IRelayer.sol";
import "./RelayedAragonApp.sol";
import "../lib/sig/ECDSA.sol";
import "../lib/math/SafeMath.sol";
import "../apps/AragonApp.sol";
import "../common/IsContract.sol";
import "../common/TimeHelpers.sol";
import "../common/MemoryHelpers.sol";
import "../common/DepositableStorage.sol";


contract Relayer is IRelayer, AragonApp, DepositableStorage {
    using ECDSA for bytes32;
    using SafeMath for uint256;
    using MemoryHelpers for bytes;

    string private constant ERROR_GAS_REFUND_FAIL = "RELAYER_GAS_REFUND_FAIL";
    string private constant ERROR_GAS_QUOTA_EXCEEDED = "RELAYER_GAS_QUOTA_EXCEEDED";
    string private constant ERROR_NONCE_ALREADY_USED = "RELAYER_NONCE_ALREADY_USED";
    string private constant ERROR_SERVICE_NOT_ALLOWED = "RELAYER_SERVICE_NOT_ALLOWED";
    string private constant ERROR_INVALID_SENDER_SIGNATURE = "RELAYER_INVALID_SENDER_SIGNATURE";

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
     * @param previousQuota Previous monthly refunds quota in ETH for each allowed member
     * @param newQuota New monthly refunds quota in ETH for each allowed member
     */
    event MonthlyRefundQuotaSet(address indexed who, uint256 previousQuota, uint256 newQuota);

    // Timestamp to start counting monthly refunds quotas for each member
    uint256 internal startDate;

    // Monthly refunds quota in ETH for each member
    uint256 internal monthlyRefundQuota;

    // Mapping that indicates whether a given address is allowed as off-chain service to relay transactions
    mapping (address => bool) internal allowedServices;

    // Mapping from members to nonce numbers that indicates the last nonce used by each member
    mapping (address => uint256) internal lastUsedNonce;

    // Mapping from members to monthly refunds that indicates the refunds requested per member per month
    mapping (address => mapping (uint256 => uint256)) internal monthlyRefunds;

    // Check whether the msg.sender belongs to the list of allowed services to relay transactions
    modifier onlyAllowedServices() {
        require(_isServiceAllowed(msg.sender), ERROR_SERVICE_NOT_ALLOWED);
        _;
    }

    /**
     * @notice Initialize Relayer app setting a monthly refunds quota per address of `@tokenAmount(_monthlyRefundQuota, 0x00)`.
     * @param _monthlyRefundQuota Monthly refunds quota in ETH for each allowed member
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
        uint256 currentMonth = _getCurrentMonth();
        uint256 requestedRefund = gasRefund.mul(gasPrice);

        require(_canUseNonce(from, nonce), ERROR_NONCE_ALREADY_USED);
        require(_canRefund(from, currentMonth, requestedRefund), ERROR_GAS_QUOTA_EXCEEDED);
        require(_isValidSignature(from, _messageHash(to, nonce, data, gasRefund, gasPrice), signature), ERROR_INVALID_SENDER_SIGNATURE);

        lastUsedNonce[from] = nonce;
        monthlyRefunds[from][currentMonth] = monthlyRefunds[from][currentMonth].add(requestedRefund);

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
     * @notice Set new monthly refunds quota per address of `@tokenAmount(newQuota, 0x00)`.
     * @param newQuota New monthly refunds quota in ETH for each allowed member
     */
    function setMonthlyRefundQuota(uint256 newQuota) external authP(SET_MONTHLY_REFUND_QUOTA_ROLE, arr(newQuota)) {
        emit MonthlyRefundQuotaSet(msg.sender, monthlyRefundQuota, newQuota);
        monthlyRefundQuota = newQuota;
    }

    /**
     * @notice Return the start date timestamp used to count the monthly refunds quotas for each member.
     * @return The start date timestamp used to count the monthly refunds quotas for each member
     */
    function getStartDate() external view isInitialized returns (uint256) {
        return startDate;
    }

    /**
     * @notice Return the monthly refunds quotas for each member.
     * @return The monthly refunds quotas for each member
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
     * @notice Return the last used nonce for a given sender `sender`.
     * @return The last used nonce for a given sender
     */
    function getLastUsedNonce(address sender) external view isInitialized returns (uint256) {
        return _getLastUsedNonce(sender);
    }

    /**
     * @notice Return the amount of refunds for a given sender `sender` corresponding to month `month`.
     * @return The amount of refunds for a given sender in a certain month
     */
    function getMonthlyRefunds(address sender, uint256 month) external view isInitialized returns (uint256) {
        return _getMonthlyRefunds(sender, month);
    }

    /**
     * @notice Tell if a given service `service` is allowed to relay transactions through the Relayer app.
     * @return True if the given service is allowed to relay transactions through the app
     */
    function isServiceAllowed(address service) external view isInitialized returns (bool) {
        return _isServiceAllowed(service);
    }

    /**
     * @notice Tell if a given sender `sender` can use the nonce number `nonce` to relay a new transaction.
     * @return True if the given sender can use the given nonce number to relay a new transaction
     */
    function canUseNonce(address sender, uint256 nonce) external view isInitialized returns (bool) {
        return _canUseNonce(sender, nonce);
    }

    /**
     * @notice Tell if a given sender `sender` can relay a new transaction spending `@tokenAmount(newQuota, 0x00)` in month `month`.
     * @return True if the given sender can relay a new transaction spending the given amount for the given month
     */
    function canRefund(address sender, uint256 month, uint256 amount) external view isInitialized returns (bool) {
        return _canRefund(sender, month, amount);
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

    function _getLastUsedNonce(address sender) internal view returns (uint256) {
        return lastUsedNonce[sender];
    }

    function _getMonthlyRefunds(address sender, uint256 month) internal view returns (uint256) {
        return monthlyRefunds[sender][month];
    }

    function _isServiceAllowed(address service) internal view returns (bool) {
        return allowedServices[service];
    }

    function _canUseNonce(address sender, uint256 nonce) internal view returns (bool) {
        return _getLastUsedNonce(sender) < nonce;
    }

    function _canRefund(address sender, uint256 month, uint256 amount) internal view returns (bool) {
        uint256 monthRefunds = _getMonthlyRefunds(sender, month);
        return monthRefunds.add(amount) <= monthlyRefundQuota;
    }

    function _isValidSignature(address sender, bytes32 hash, bytes signature) internal pure returns (bool) {
        address signer = hash.toEthSignedMessageHash().recover(signature);
        return sender == signer;
    }

    function _messageHash(address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(to, nonce, keccak256(data), gasRefund, gasPrice));
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
}
