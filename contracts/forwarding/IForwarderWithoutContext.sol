/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IForwarder.sol";


/**
* @title Forwarder interface
* @dev This forwarder interface does not support attaching a context information to the forwarded actions.
*      Unlike `IForwarderWithoutContextPayable`, this forwarder interface does not allow receiving ETH on the forward entry point.
*/
contract IForwarderWithoutContext is IForwarder {
    uint256 internal constant FORWARDER_TYPE = 1;

    /**
    * @dev Forward an EVM script
    */
    function forward(bytes evmScript) external payable;

    /**
    * @dev Tell the type identification number of the current forwarder
    * @return Always 1 - Forwarder type ID for the non-payable forwarder without context
    */
    function forwarderType() external pure returns (uint256) {
        return FORWARDER_TYPE;
    }
}
