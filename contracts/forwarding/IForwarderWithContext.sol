/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IForwarder.sol";


/**
* @title Forwarder interface requiring context information
* @dev This forwarder interface enforces an additional piece of information attached to the action being forwarded
*      with the purpose of allowing the sender to provide a detailed context for the forwarded action.
*      Unlike `IForwarderWithContextPayable`, this forwarder interface allows receiving ETH on the forward entry point.
*/
contract IForwarderWithContext is IForwarder {
    uint256 internal constant FORWARDER_TYPE = 3;

    /**
    * @dev Forward an EVM script with an attached context information
    */
    function forward(bytes evmScript, bytes context) external;

    /**
    * @dev Tell the type identification number of the current forwarder
    * @return Always 3 - Forwarder type ID for the non-payable forwarder with context
    */
    function forwarderType() external pure returns (uint256) {
        return FORWARDER_TYPE;
    }
}
