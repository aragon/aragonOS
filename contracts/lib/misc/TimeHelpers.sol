/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;


contract TimeHelpers {
    /**
    * @dev Returns the current block number.
    *      Using a function rather than `block.number` allows us to easily mock the block number in
    *      tests.
    */
    function getBlockNumber() internal view returns (uint256) {
        return block.number;
    }

    /**
    * @dev Returns the current block number, converted to uint64.
    *      Using a function rather than `block.number` allows us to easily mock the block number in
    *      tests.
    */
    function getBlockNumber64() internal view returns (uint64) {
        return uint64(block.number);
    }

    /**
    * @dev Returns the current timestamp.
    *      Using a function rather than `now` allows us to easily mock it in
    *      tests.
    */
    function getTimestamp() internal view returns (uint256) {
        return now;
    }

    /**
    * @dev Returns the current timestamp, covnerted to uint64.
    *      Using a function rather than `now` allows us to easily mock it in
    *      tests.
    */
    function getTimestamp64() internal view returns (uint64) {
        return uint64(now);
    }
}
