/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./AragonApp.sol";


// Using UnsafeAragonApp means you'll be playing with 🔥.
// A number of safe defaults are provided with AragonApp, to help you avoid dangerous situations
// and mistakes with how your contract's developed as well as how it's deployed.
// UnsafeAragonApp turns off these safety features to give you greater control over you contract.
// In particular, it allows you to:
//   - Directly use deployed base contracts as apps, without a proxy
contract UnsafeAragonApp is AragonApp {
    function UnsafeAragonApp() public {
        // Removes auto petrifying
        delete initializationBlock;
    }
}
