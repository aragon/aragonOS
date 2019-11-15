/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.5.1;


interface IACL {
    function initialize(address permissionsCreator) external;

    // TODO: this should be external
    // See https://github.com/ethereum/solidity/issues/4832
    function hasPermission(address who, address where, bytes32 what, bytes calldata how) external view returns (bool);
}
