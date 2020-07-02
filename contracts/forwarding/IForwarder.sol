/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IAbstractForwarder.sol";


/**
* @title Forwarder interface
* @dev This is the basic forwarder interface, that only supports forwarding an EVM script.
*      It does not support forwarding additional context or receiving ETH; other interfaces are available to support those.
*/
contract IForwarder is IAbstractForwarder {
    /**
    * @dev Forward an EVM script
    */
    function forward(bytes evmScript) external;

    /**
    * @dev Tell the forwarder type
    * @return Always 1 (ForwarderType.NO_CONTEXT)
    */
    function forwarderType() external pure returns (ForwarderType) {
        return ForwarderType.NO_CONTEXT;
    }
}
