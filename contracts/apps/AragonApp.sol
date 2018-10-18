/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "./AppStorage.sol";
import "../common/Autopetrified.sol";
import "../common/VaultRecoverable.sol";
import "../evmscript/EVMScriptRunner.sol";
import "../acl/ACLSyntaxSugar.sol";


// Contracts inheriting from AragonApp are, by default, immediately petrified upon deployment so
// that they can never be initialized.
// Unless overriden, this behaviour enforces those contracts to be usable only behind an AppProxy.
// ACLSyntaxSugar and EVMScriptRunner are not directly used by this contract, but are included so
// that they are automatically usable by subclassing contracts
contract AragonApp is AppStorage, Autopetrified, VaultRecoverable, EVMScriptRunner, ACLSyntaxSugar {
    string private constant ERROR_AUTH_FAILED = "APP_AUTH_FAILED";
    string private constant ERROR_NONCE_REUSE = "APP_NONCE_REUSE";
    string private constant ERROR_INVALID_SIGNATURE = "APP_INVALID_SIGNATURE";

    address internal constant ZERO_ADDRESS = address(0);

    modifier auth(bytes32 _role) {
        require(canPerform(sender(), _role, new uint256[](0)), ERROR_AUTH_FAILED);
        _;
    }

    modifier authP(bytes32 _role, uint256[] _params) {
        require(canPerform(sender(), _role, _params), ERROR_AUTH_FAILED);
        _;
    }

    // TODO: support standard? https://eips.ethereum.org/EIPS/eip-1077
    function exec(address signer, bytes calldata, uint256 nonce, bytes signature) public {
        require(!usedNonce(signer, nonce), ERROR_NONCE_REUSE);
        bytes32 signedHash = executionHash(calldata, nonce);

        require(isValidSignature(signer, signedHash, signature), ERROR_INVALID_SIGNATURE);

        // This won't be too expensive on Constantinople: https://eips.ethereum.org/EIPS/eip-1283
        setVolatileStorageSender(signer);
        setUsedNonce(signer, nonce, true);
        bool success = address(this).call(calldata);
        if (!success){
            // no need to clean up storage as the entire execution frame is reverted
            revertForwadingError();
        }
        setVolatileStorageSender(ZERO_ADDRESS);
    }

    /**
    * @dev Check whether an action can be performed by a sender for a particular role on this app
    * @param _sender Sender of the call
    * @param _role Role on this app
    * @param _params Permission params for the role
    * @return Boolean indicating whether the sender has the permissions to perform the action.
    *         Always returns false if the app hasn't been initialized yet.
    */
    function canPerform(address _sender, bytes32 _role, uint256[] _params) public view returns (bool) {
        if (!hasInitialized()) {
            return false;
        }

        IKernel linkedKernel = kernel();
        if (address(linkedKernel) == address(0)) {
            return false;
        }

        bytes memory how; // no need to init memory as it is never used
        if (_params.length > 0) {
            uint256 byteLength = _params.length * 32;
            assembly {
                how := _params // forced casting
                mstore(how, byteLength)
            }
        }
        return linkedKernel.hasPermission(_sender, address(this), _role, how);
    }

    /**
    * @dev Get the recovery vault for the app
    * @return Recovery vault address for the app
    */
    function getRecoveryVault() public view returns (address) {
        // Funds recovery via a vault is only available when used with a kernel
        return kernel().getRecoveryVault(); // if kernel is not set, it will revert
    }

    function isValidSignature(address signer, bytes32 hash, bytes signature) public pure returns (bool) {
        // TODO: Actually check signature.
        return true; // YOLO
    }

    function executionHash(bytes calldata, uint256 nonce) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(calldata), nonce));
    }

    function revertForwadingError() internal {
        assembly {
            let size := returndatasize
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            revert(ptr, size)
        }
    }

    function sender() internal view returns (address) {
        // Prevents a sub-frame from re-entering into the app while the signer is authenticated
        if (msg.sender != address(this)) {
            return msg.sender;
        }

        address volatileSender = volatileStorageSender();
        return volatileSender != ZERO_ADDRESS ? volatileSender : address(this);
    }
}
