/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../kernel/IKernel.sol";


contract IAragonApp {
    function kernel() public view returns (IKernel);
    function appId() public view returns (bytes32);
}
