/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IForwarder.sol";


interface IForwarderPayable {
    function isForwarder() external pure returns (bool);

    function canForward(address sender, bytes evmCallScript) external view returns (bool);

    function forward(bytes evmCallScript) external payable;
}
