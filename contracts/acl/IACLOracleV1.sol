/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title Previous version of the ACL Oracle interface (aragonOS@4)
* @dev This interface simply defines a predicate method that must be implemented by smart contracts intended to be used as ACL Oracles.
*      ACL oracles should be used if you would like to protect a permission with custom logic from an external contract.
*/
interface IACLOracleV1 {
    function canPerform(address who, address where, bytes32 what, uint256[] how) external view returns (bool);
}
