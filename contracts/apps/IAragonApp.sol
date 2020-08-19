/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../kernel/IKernel.sol";


contract IAragonApp {
    // Includes appId and kernel methods:
    bytes4 internal constant ARAGON_APP_INTERFACE_ID = bytes4(0x54053e6c);

    function kernel() public view returns (IKernel);
    function appId() public view returns (bytes32);
}
