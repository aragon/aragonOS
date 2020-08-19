/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;


/**
* @title Forwarder fee interface
* @dev Interface for declaring any fee requirements for the `forward()` function.
*/
interface IForwarderFee {
    /**
    * @dev Provide details about the required fee token and amount
    * @return Fee token and fee amount. If ETH, returns EtherTokenConstant for the `feeToken`.
    */
    function forwardFee() external view returns (address feeToken, uint256 feeAmount);
}
