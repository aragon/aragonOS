/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IAbstractForwarder.sol";
import "./IForwarderFee.sol";


/**
* @title Payable forwarder interface requiring context information
* @dev This forwarder interface allows for additional context to be attached to the action by the sender.
*      Unlike `IForwarderWithContext`, this interface allows `forward()` to receive ETH and therefore includes the IForwarderFee interface.
*      It is **RECOMMENDED** that only apps requiring a payable `forward()` use this interface.
*/
contract IForwarderWithContextPayable is IAbstractForwarder, IForwarderFee {
    /**
    * @dev Forward an EVM script with an attached context
    */
    function forward(bytes evmScript, bytes context) external payable;

    /**
    * @dev Tell the forwarder type
    * @return Always 2 (ForwarderType.WITH_CONTEXT)
    */
    function forwarderType() external pure returns (ForwarderType) {
        return ForwarderType.WITH_CONTEXT;
    }
}
