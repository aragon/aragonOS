/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;


library AddressUtils {
    address internal constant ZERO_ADDRESS = address(0);

    function isZero(address _target) internal pure returns (bool) {
        return _target == ZERO_ADDRESS;
    }

    function isNotZero(address _target) internal pure returns (bool) {
        return _target != ZERO_ADDRESS;
    }

    /*
    * NOTE: this should NEVER be used for authentication
    * (see pitfalls: https://github.com/fergarrui/ethereum-security/tree/master/contracts/extcodesize).
    *
    * This is only intended to be used as a sanity check that an address is actually a contract,
    * RATHER THAN an address not being a contract.
    */
    function isContract(address _target) internal view returns (bool) {
        if (isZero(_target)) {
            return false;
        }

        uint256 size;
        assembly { size := extcodesize(_target) }
        return size > 0;
    }
}
