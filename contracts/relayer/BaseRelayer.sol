pragma solidity ^0.4.24;

import "../lib/sig/ECDSA.sol";
import "../apps/AragonApp.sol";
import "../common/DepositableStorage.sol";


contract BaseRelayer is AragonApp, DepositableStorage {
    using ECDSA for bytes32;

    bytes32 public constant OFF_CHAIN_RELAYER_SERVICE_ROLE = keccak256("OFF_CHAIN_RELAYER_SERVICE_ROLE");

    uint256 private constant EXTERNAL_TX_COST = 21000;

    string private constant ERROR_GAS_REFUND_FAIL = "RELAYER_GAS_REFUND_FAIL";
    string private constant ERROR_NONCE_ALREADY_USED = "RELAYER_NONCE_ALREADY_USED";
    string private constant ERROR_INVALID_SENDER_SIGNATURE = "RELAYER_INVALID_SENDER_SIGNATURE";

    event FundsReceived(address indexed sender, uint256 amount);
    event TransactionRelayed(address indexed from, address indexed to, uint256 nonce, bytes calldata);

    modifier refundGas() {
        uint256 startGas = gasleft();
        _;
        uint256 refund = EXTERNAL_TX_COST + startGas - gasleft();
        require(msg.sender.send(refund), ERROR_GAS_REFUND_FAIL);
    }

    function () external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    function initialize() public onlyInit {
        initialized();
        setDepositable(true);
    }

    function isNonceUsed(address sender, uint256 nonce) public view returns (bool);

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

    function revertForwardingError() internal {
        assembly {
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize)
            revert(ptr, returndatasize)
        }
    }
}
