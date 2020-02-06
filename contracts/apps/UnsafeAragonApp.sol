/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../common/UnstructuredStorage.sol";
import "./AragonApp.sol";


// Using UnsafeAragonApp means you'll be playing with 🔥.
// A number of safe defaults are provided with AragonApp, to help you avoid dangerous situations
// and mistakes with how your contract's developed as well as how it's deployed.
// UnsafeAragonApp turns off these safety features to give you greater control over your contract.
// In particular, it allows you to:
//   - Use deployed base contracts as apps directly, without a proxy
contract UnsafeAragonApp is AragonApp {
    using UnstructuredStorage for bytes32;

    constructor() public {
        // Removes auto petrifying; simulates a delete at INITIALIZATION_BLOCK_POSITION
        INITIALIZATION_BLOCK_POSITION.setStorageUint256(0);
    }
}
