/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./Initializable.sol";


contract Petrifiable is Initializable {
    // Use block UINT256_MAX (which should be never) as the initializable date
    uint256 constant internal PETRIFIED_DATE = uint256(-1);

    function isPetrified() public view returns (bool) {
        return initializationBlock == PETRIFIED_DATE;
    }

    /**
    * @dev Function to be called by top level contract to prevent being initialized.
    *      Useful for freezing base contracts when they're used behind proxies.
    */
    function petrify() internal onlyInit {
        initializedAt(PETRIFIED_DATE);
    }
}
