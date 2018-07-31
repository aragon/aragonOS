/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./Petrifiable.sol";


contract Autopetrified is Petrifiable {
    function Autopetrified() public {
        // Petrify base instances of subclasses from Autopetrified.
        // This renders the bases uninitializable (and unusable without a proxy).
        petrify();
    }
}
