/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title Previous version of the ACL Oracle interface
* @dev This interface simply defines a check method that must be implemented by smart contracts to be plugged in as ACL oracles.
*      ACL oracles are the most suitable way to have external contracts validating ACL permissions with custom logic.
*/
interface IACLOracleV1 {
    function canPerform(address who, address where, bytes32 what, uint256[] how) external view returns (bool);
}
