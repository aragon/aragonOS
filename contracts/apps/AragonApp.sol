/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./AppStorage.sol";
import "../acl/ACLSyntaxSugar.sol";
import "../common/Autopetrified.sol";
import "../common/ConversionHelpers.sol";
import "../common/ReentrancyGuard.sol";
import "../common/VaultRecoverable.sol";
import "../evmscript/EVMScriptRunner.sol";


// Contracts inheriting from AragonApp are, by default, immediately petrified upon deployment so
// that they can never be initialized.
// Unless overriden, this behaviour enforces those contracts to be usable only behind an AppProxy.
// ReentrancyGuard, EVMScriptRunner, and ACLSyntaxSugar are not directly used by this contract, but
// are included so that they are automatically usable by subclassing contracts
contract AragonApp is AppStorage, Autopetrified, VaultRecoverable, ReentrancyGuard, EVMScriptRunner, ACLSyntaxSugar {
    string private constant ERROR_AUTH_FAILED = "APP_AUTH_FAILED";

    modifier auth(bytes32 _role) {
        require(canPerform(msg.sender, _role, new uint256[](0)), ERROR_AUTH_FAILED);
        _;
    }

    modifier authP(bytes32 _role, uint256[] _params) {
        require(canPerform(msg.sender, _role, _params), ERROR_AUTH_FAILED);
        _;
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
        IKernel linkedKernel = kernel();
        if (address(linkedKernel) == address(0) || !isCallEnabled()) {
            return false;
        }

        return linkedKernel.hasPermission(
            _sender,
            address(this),
            _role,
            ConversionHelpers.dangerouslyCastUintArrayToBytes(_params)
        );
    }

    /**
    * @dev Check whether a call to the current app can be executed or not based on the kill-switch settings
    * @return Boolean indicating whether the call could be executed or not
    */
    function isCallEnabled() public view returns (bool) {
        if (!hasInitialized()) {
            return false;
        }

        IKernel _kernel = kernel();
        bytes4 selector = _kernel.isAppDisabled.selector;
        bytes memory isAppDisabledCalldata = abi.encodeWithSelector(selector, appId(), address(this));
        bool success;
        assembly {
            success := staticcall(gas, _kernel, add(isAppDisabledCalldata, 0x20), mload(isAppDisabledCalldata), 0, 0)
        }

        // If the call to `kernel.isAppDisabled()` reverts (using an old or non-existent Kernel) we consider that
        // there is no kill switch. Therefore, the the call can be executed.
        if (!success) {
            return true;
        }

        // If it does not revert, check if the returned value is 32-bytes length, otherwise return false
        uint256 _outputLength;
        assembly { _outputLength := returndatasize }
        if (_outputLength != 32) {
            return false;
        }

        // Forward returned value
        bool _shouldDenyCall;
        assembly {
            let ptr := mload(0x40)        // get next free memory pointer
            mstore(0x40, add(ptr, 0x20))  // set next free memory pointer
            returndatacopy(ptr, 0, 0x20)  // copy call return value
            _shouldDenyCall := mload(ptr) // read data
        }
        return !_shouldDenyCall;
    }

    /**
    * @dev Get the recovery vault for the app
    * @return Recovery vault address for the app
    */
    function getRecoveryVault() public view returns (address) {
        // Funds recovery via a vault is only available when used with a kernel
        return kernel().getRecoveryVault(); // if kernel is not set, it will revert
    }
}
