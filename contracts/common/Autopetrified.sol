/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./Petrifiable.sol";


contract Autopetrified is Petrifiable {
    function Autopetrified() public {
        // Petrify deployed (non-proxy) instances of subclasses from Autopetrified.
        // This renders the base deployments uninitializable (and unusable without a proxy).
        petrify();
    }
}
