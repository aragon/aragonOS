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

    bytes32 public constant ALLOW_OFF_CHAIN_SERVICE_ROLE = keccak256("ALLOW_OFF_CHAIN_SERVICE_ROLE");
    bytes32 public constant DISALLOW_OFF_CHAIN_SERVICE_ROLE = keccak256("DISALLOW_OFF_CHAIN_SERVICE_ROLE");

    string private constant ERROR_GAS_REFUND_FAIL = "RELAYER_GAS_REFUND_FAIL";
    string private constant ERROR_GAS_QUOTA_EXCEEDED = "RELAYER_GAS_QUOTA_EXCEEDED";
    string private constant ERROR_NONCE_ALREADY_USED = "RELAYER_NONCE_ALREADY_USED";
    string private constant ERROR_SERVICE_NOT_ALLOWED = "RELAYER_SERVICE_NOT_ALLOWED";
    string private constant ERROR_INVALID_SENDER_SIGNATURE = "RELAYER_INVALID_SENDER_SIGNATURE";

    event ServiceAllowed(address indexed service);
    event ServiceDisallowed(address indexed service);
    event TransactionRelayed(address from, address to, uint256 nonce, bytes calldata);

    uint256 public startDate;
    uint256 public monthlyRefundQuota;
    mapping (address => bool) internal allowedServices;
    mapping (address => uint256) internal totalRefunds;
    mapping (address => uint256) internal lastUsedNonce;

    modifier onlyAllowedServices() {
        require(isServiceAllowed(msg.sender), ERROR_SERVICE_NOT_ALLOWED);
        _;
    }

    function initialize(uint256 _monthlyRefundQuota) public onlyInit {
        initialized();
        startDate = getTimestamp();
        monthlyRefundQuota = _monthlyRefundQuota;
        setDepositable(true);
    }

    function relay(address from, address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice, bytes signature)
        external
        onlyAllowedServices
    {
        uint256 refund = gasRefund.mul(gasPrice);
        require(canRefund(from, refund), ERROR_GAS_QUOTA_EXCEEDED);
        require(!isNonceUsed(from, nonce), ERROR_NONCE_ALREADY_USED);
        require(isValidSignature(from, messageHash(to, nonce, data, gasRefund, gasPrice), signature), ERROR_INVALID_SENDER_SIGNATURE);

        totalRefunds[from] = totalRefunds[from].add(refund);
        lastUsedNonce[from] = nonce;

        relayCall(from, to, data);
        emit TransactionRelayed(from, to, nonce, data);

        require(msg.sender.send(refund), ERROR_GAS_REFUND_FAIL);
    }

    function allowService(address service) external authP(ALLOW_OFF_CHAIN_SERVICE_ROLE, arr(service)) {
        allowedServices[service] = true;
        emit ServiceAllowed(service);
    }

    function disallowService(address service) external authP(DISALLOW_OFF_CHAIN_SERVICE_ROLE, arr(service)) {
        allowedServices[service] = false;
        emit ServiceDisallowed(service);
    }

    function allowRecoverability(address token) public view returns (bool) {
        // does not allow to recover ETH
        return token != ETH;
    }

    function isServiceAllowed(address service) public view returns (bool) {
        return allowedServices[service];
    }

    function getLastUsedNonce(address sender) public view returns (uint256) {
        return lastUsedNonce[sender];
    }

    function getTotalRefunds(address sender) public view returns (uint256) {
        return totalRefunds[sender];
    }

    function isNonceUsed(address sender, uint256 nonce) public view returns (bool) {
        return getLastUsedNonce(sender) >= nonce;
    }

    function canRefund(address sender, uint256 refund) public view returns (bool) {
        uint256 monthsSinceStart = (getTimestamp().sub(startDate) / (30 days)) + 1;
        uint256 maxRefunds = monthsSinceStart.mul(monthlyRefundQuota);
        return getTotalRefunds(sender).add(refund) <= maxRefunds;
    }

    function isValidSignature(address sender, bytes32 hash, bytes signature) internal pure returns (bool) {
        address signer = hash.toEthSignedMessageHash().recover(signature);
        return sender == signer;
    }

    function messageHash(address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(to, nonce, keccak256(data), gasRefund, gasPrice));
    }

    function relayCall(address from, address to, bytes data) internal {
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
