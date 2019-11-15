/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.5.1;


interface IACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] calldata how) external view returns (bool);
}
