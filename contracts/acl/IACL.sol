/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


interface IACL {
    function initialize(address permissionsCreator) external;

    function hasPermission(address who, address where, bytes32 what, bytes how) external view returns (bool);
}
