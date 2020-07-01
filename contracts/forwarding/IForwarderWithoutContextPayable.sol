/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IForwarder.sol";


/**
* @title Payable Forwarder interface
* @dev This forwarder interface does not support attaching a context information to the forwarded actions.
*      Unlike `IForwarderWithoutContext`, this forwarder interface allows receiving ETH on the forward entry point.
*/
contract IForwarderWithoutContextPayable is IForwarder {
    uint256 internal constant FORWARDER_TYPE = 2;

    /**
    * @dev Forward an EVM script
    */
    function forward(bytes evmScript) external payable;

    /**
    * @dev Tell the type identification number of the current forwarder
    * @return Always 2 - Forwarder type ID for the payable forwarder without context
    */
    function forwarderType() external pure returns (uint256) {
        return FORWARDER_TYPE;
    }
}
