/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;


contract UnstructuredStorage {
    // keccak256("uint256.initializationBlock"), used by Initializable
    bytes32 public constant initializationBlockPosition = 0xd9120073d934f0c287a3a735b193740486dbba88578fd8f3cbb2b9a9b654e7ce;

    function setStorageAddress(bytes32 position, address data) internal {
        assembly { sstore(position, data) }
    }

    function setStorageBytes32(bytes32 position, bytes32 data) internal {
        assembly { sstore(position, data) }
    }

    function setStorageUint256(bytes32 position, uint256 data) internal {
        assembly { sstore(position, data) }
    }

    function getStorageAddress(bytes32 position) public view returns (address data) {
        assembly { data := sload(position) }
    }

    function getStorageBytes32(bytes32 position) public view returns (bytes32 data) {
        assembly { data := sload(position) }
    }

    function getStorageUint256(bytes32 position) public view returns (uint256 data) {
        assembly { data := sload(position) }
    }
}
