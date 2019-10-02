/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


interface IForwarderFee {
    function forwardFee() external view returns (address, uint256);
}
