pragma solidity ^0.4.11;

contract UIntStorage {
    mapping (bytes32 => uint256) uintStorage;

    function storageSet(bytes32 key, uint256 value) internal {
        uintStorage[key] = value;
    }

    function storageGet(bytes32 key) constant internal returns (uint256) {
        return uintStorage[key];
    }
}
