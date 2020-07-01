/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title ACL Oracle interface
* @dev This interface simply defines a check method that must be implemented by smart contracts to be plugged in as ACL oracles.
*      ACL oracles are the most suitable way to have external contracts validating ACL permissions with custom logic.
*/
interface IACLOracle {
    /**
    * @dev Tells whether `user` can execute `what`(`how`) in `where` if it's currently set up for `who`
    * @param user Entity trying to execute `what` in `where`
    * @param who Entity to which `what` is granted based on the current ACL permissions configuration
    * @param where Entity where `what` is trying to be executed
    * @param what Identifier of the action willing to be executed in `where`
    * @param how Can be used to define a set of arguments to give more context about `what` is trying to be executed in `where`
    * @return True if the user is allowed to execute the requested action for the given context, false otherwise
    */
    function canPerform(address user, address who, address where, bytes32 what, uint256[] how) external view returns (bool);
}
