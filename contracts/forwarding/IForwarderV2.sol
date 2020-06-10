/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IForwarderPayable.sol";


// TODO: Cannot inherit interfaces in Solidity 0.4.24
contract IForwarderV2 is IForwarderPayable {
    function forward(bytes evmCallScript, bytes context) external payable;
}
