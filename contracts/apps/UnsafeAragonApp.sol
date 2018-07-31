/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./AragonApp.sol";


contract UnsafeAragonApp is AragonApp {
    function UnsafeAragonApp() public {
        delete initializationBlock;
    }
}
