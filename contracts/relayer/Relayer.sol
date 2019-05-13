pragma solidity ^0.4.24;

import "./IRelayer.sol";
import "./RelayedAragonApp.sol";
import "../lib/sig/ECDSA.sol";
import "../apps/AragonApp.sol";
import "../common/MemoryHelpers.sol";
import "../common/DepositableStorage.sol";


contract Relayer is IRelayer, AragonApp, DepositableStorage {
    using ECDSA for bytes32;
    using MemoryHelpers for bytes;

    bytes32 public constant ALLOW_OFF_CHAIN_SERVICE_ROLE = keccak256("ALLOW_OFF_CHAIN_SERVICE_ROLE");
    bytes32 public constant DISALLOW_OFF_CHAIN_SERVICE_ROLE = keccak256("DISALLOW_OFF_CHAIN_SERVICE_ROLE");

    uint256 private constant EXTERNAL_TX_COST = 21000;

    string private constant ERROR_GAS_REFUND_FAIL = "RELAYER_GAS_REFUND_FAIL";
    string private constant ERROR_NONCE_ALREADY_USED = "RELAYER_NONCE_ALREADY_USED";
    string private constant ERROR_SERVICE_NOT_ALLOWED = "RELAYER_SERVICE_NOT_ALLOWED";
    string private constant ERROR_INVALID_SENDER_SIGNATURE = "RELAYER_INVALID_SENDER_SIGNATURE";

    event ServiceAllowed(address indexed service);
    event ServiceDisallowed(address indexed service);
    event TransactionRelayed(address from, address to, uint256 nonce, bytes calldata);

    mapping (address => bool) internal allowedServices;
    mapping (address => uint256) internal lastUsedNonce;

    modifier onlyAllowedServices() {
        require(allowedServices[msg.sender], ERROR_SERVICE_NOT_ALLOWED);
        _;
    }

    modifier refundGas() {
        uint256 startGas = gasleft();
        _;
        uint256 totalGas = EXTERNAL_TX_COST + startGas - gasleft();
        uint256 refund = totalGas * tx.gasprice;
        require(msg.sender.send(refund), ERROR_GAS_REFUND_FAIL);
    }

    function initialize() public onlyInit {
        initialized();
        setDepositable(true);
    }

    function relay(address from, address to, uint256 nonce, bytes calldata, bytes signature) external refundGas onlyAllowedServices {
        assertValidTransaction(from, nonce, calldata, signature);

        lastUsedNonce[from] = nonce;
        relayCall(from, to, calldata);
        emit TransactionRelayed(from, to, nonce, calldata);
        forwardReturnedData();
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

    function isNonceUsed(address sender, uint256 nonce) public view returns (bool) {
        return lastUsedNonce[sender] >= nonce;
    }

    function assertValidTransaction(address from, uint256 nonce, bytes calldata, bytes signature) internal view {
        require(!isNonceUsed(from, nonce), ERROR_NONCE_ALREADY_USED);
        require(isValidSignature(from, messageHash(calldata, nonce), signature), ERROR_INVALID_SENDER_SIGNATURE);
    }

    function isValidSignature(address sender, bytes32 hash, bytes signature) internal pure returns (bool) {
        address signer = hash.toEthSignedMessageHash().recover(signature);
        return sender == signer;
    }

    function messageHash(bytes calldata, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(calldata), nonce));
    }

    function relayCall(address from, address to, bytes calldata) internal {
        bytes memory encodedSignerCalldata = calldata.append(from);
        assembly {
            let success := call(gas, to, 0, add(encodedSignerCalldata, 0x20), mload(encodedSignerCalldata), 0, 0)
            switch success case 0 {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize)
                revert(ptr, returndatasize)
            }
        }
    }

    function forwardReturnedData() private {
        assembly {
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize)
            return(ptr, returndatasize)
        }
    }
}
