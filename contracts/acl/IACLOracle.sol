/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title ACL Oracle interface
* @dev This interface simply defines a predicate method that must be implemented by smart contracts intended to be used as ACL Oracles.
*      ACL oracles should be used if you would like to protect a permission with custom logic from an external contract.
*/
interface IACLOracle {
    /**
    * @dev Tells whether `sender` can execute `what` (and `how`) in `where` for the grantee `who`
    * @param who Sender of the original call
    * @param grantee Grantee of the permission being evaluated
    * @param where Address of the app
    * @param what Identifier for a group of actions in app (role)
    * @param how Permission parameters
    * @return True if the action should be accepted
    */
    function canPerform(address who, address grantee, address where, bytes32 what, uint256[] how) external view returns (bool);
}
