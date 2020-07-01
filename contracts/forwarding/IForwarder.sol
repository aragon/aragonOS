/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title Forwarder interface requiring context information
* @dev This interface allows building a simple forwarding protocol. The main purpose is to be able to build
*      forwarding chains that allow smart contracts execute EVM scripts in the context of other smart contracts.
*      Similar to how delegate calls work but having the ability to chain multiple steps which may not necessarily be synchronous.
*/
interface IForwarder {
    /**
    * @dev Forwarder interface requiring context information
    * @return True if the forwarder can forward the given evm script for the requested sender, false otherwise
    */
    function canForward(address sender, bytes evmScript) external view returns (bool);

    /**
    * @dev Tell the type identification number of the current forwarder
    * @return Type identification number of the current forwarder
    */
    function forwarderType() external pure returns (uint256 forwarderTypeId);
}
