/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IForwarder.sol";
import "./IForwarderFee.sol";


/**
* @title Payable forwarder interface
* @dev This is the basic forwarder interface, that only supports forwarding an EVM script.
*      Unlike `IForwarder`, this interface allows `forward()` to receive ETH and therefore includes the IForwarderFee interface.
*      It is **RECOMMENDED** that only apps requiring a payable `forward()` use this interface.
*/
contract IForwarderPayable is IAbstractForwarder, IForwarderFee {
    /**
    * @dev Forward an EVM script
    */
    function forward(bytes evmScript) external payable;

    /**
    * @dev Tell the forwarder type
    * @return Always 1 (ForwarderType.NO_CONTEXT)
    */
    function forwarderType() external pure returns (ForwarderType) {
        return ForwarderType.NO_CONTEXT;
    }
}
