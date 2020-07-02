/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IAbstractForwarder.sol";


/**
* @title Forwarder interface requiring context information
* @dev This forwarder interface allows for additional context to be attached to the action by the sender.
*/
contract IForwarderWithContext is IAbstractForwarder {
    /**
    * @dev Forward an EVM script with an attached context
    */
    function forward(bytes evmScript, bytes context) external;

    /**
    * @dev Tell the forwarder type
    * @return Always 2 (ForwarderType.WITH_CONTEXT)
    */
    function forwarderType() external pure returns (ForwarderType) {
        return ForwarderType.WITH_CONTEXT;
    }
}
