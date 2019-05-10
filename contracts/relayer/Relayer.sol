pragma solidity ^0.4.24;

import "./RelayHelper.sol";
import "../lib/sig/ECDSA.sol";
import "../apps/AragonApp.sol";
import "../common/DepositableStorage.sol";


contract Relayer is AragonApp, DepositableStorage {
    using ECDSA for bytes32;

    bytes32 public constant OFF_CHAIN_RELAYER_SERVICE_ROLE = keccak256("OFF_CHAIN_RELAYER_SERVICE_ROLE");

    uint256 private constant EXTERNAL_TX_COST = 21000;

    string private constant ERROR_GAS_REFUND_FAIL = "RELAYER_GAS_REFUND_FAIL";
    string private constant ERROR_NONCE_ALREADY_USED = "RELAYER_NONCE_ALREADY_USED";
    string private constant ERROR_INVALID_SENDER_SIGNATURE = "RELAYER_INVALID_SENDER_SIGNATURE";

    event TransactionRelayed(address indexed from, address indexed to, uint256 nonce, bytes calldata);

    mapping (address => uint256) internal lastUsedNonce;

    modifier refundGas() {
        uint256 startGas = gasleft();
        _;
        uint256 refund = EXTERNAL_TX_COST + startGas - gasleft();
        require(msg.sender.send(refund), ERROR_GAS_REFUND_FAIL);
    }

    function initialize() public onlyInit {
        initialized();
        setDepositable(true);
    }

    function allowRecoverability(address token) public view returns (bool) {
        // does not allow to recover ETH
        return token != ETH;
    }

    function relay(address from, address to, uint256 nonce, bytes calldata, bytes signature) external refundGas auth(OFF_CHAIN_RELAYER_SERVICE_ROLE) {
        assertValidTransaction(from, nonce, calldata, signature);

        lastUsedNonce[from] = nonce;
        bool success = to.call(calldata);
        if (!success) RelayHelper.revertForwardingError();
        emit TransactionRelayed(from, to, nonce, calldata);
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
}
