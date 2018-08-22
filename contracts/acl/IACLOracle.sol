/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;


interface IACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] how) public view returns (bool);
}
