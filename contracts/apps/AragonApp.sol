/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./AppStorage.sol";
import "../common/Petrifiable.sol";
import "../common/VaultRecoverable.sol";
import "../evmscript/EVMScriptRunner.sol";
import "../acl/ACLSyntaxSugar.sol";


// ACLSyntaxSugar and EVMScriptRunner are not directly used by this contract, but are included so
// that they are automatically usable by subclassing contracts
contract AragonApp is AppStorage, Petrifiable, ACLSyntaxSugar, VaultRecoverable, EVMScriptRunner {
    /**
    * @dev If no kernel is provided when deploying the app, this instance is immediately petrified
    *      so that it can never be initialized.
    * @param _kernel Kernel to connect the deployed app to
    */
    function AragonApp(IKernel _kernel) public {
        if (_kernel == address(0)) {
            petrify();
        } else {
            kernel = _kernel;
        }
    }

    modifier auth(bytes32 _role) {
        require(canPerform(msg.sender, _role, new uint256[](0)));
        _;
    }

    modifier authP(bytes32 _role, uint256[] params) {
        require(canPerform(msg.sender, _role, params));
        _;
    }

    function canPerform(address _sender, bytes32 _role, uint256[] params) public view returns (bool) {
        if (!hasInitialized()) {
            return false;
        }

        bytes memory how; // no need to init memory as it is never used
        if (params.length > 0) {
            uint256 byteLength = params.length * 32;
            assembly {
                how := params // forced casting
                mstore(how, byteLength)
            }
        }
        return address(kernel) == 0 || kernel.hasPermission(_sender, address(this), _role, how);
    }

    function getRecoveryVault() public view returns (address) {
        // Funds recovery via a vault is only available when used with a kernel
        require(address(kernel) != 0);
        return kernel.getRecoveryVault();
    }
}
