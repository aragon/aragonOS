/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title Abstract forwarder interface
* @dev This is the base interface for all forwarders.
*      Forwarding allows separately installed applications (smart contracts implementing the forwarding interface) to execute multi-step actions via EVM scripts.
*      You should only support the forwarding interface if your "action step" is asynchronous (e.g. requiring a delay period or a voting period).
*      Note: you should **NOT** directly inherit from this interface; see one of the other, non-abstract interfaces available.
*/
contract IAbstractForwarder {
    enum ForwarderType {
        NOT_IMPLEMENTED,
        NO_CONTEXT,
        WITH_CONTEXT
    }

    /**
    * @dev Tell whether the proposed forwarding path (an EVM script) from the given sender is allowed.
    *      However, this is not a strict guarantee of safety: the implemented `forward()` method is
    *      still allowed to revert even if `canForward()` returns true for the same parameters.
    * @return True if the sender's proposed path is allowed
    */
    function canForward(address sender, bytes evmScript) external view returns (bool);

    /**
    * @dev Tell the forwarder type
    * @return Forwarder type
    */
    function forwarderType() external pure returns (ForwarderType);

    /**
    * @dev Report whether the implementing app is a forwarder
    *      Required for backwards compatibility with aragonOS 4
    * @return Always true
    */
    function isForwarder() external pure returns (bool) {
        return true;
    }
}
