pragma solidity ^0.4.11;

import "./IDAO.sol";
import "./UIntStorage.sol";

contract DAOStorage is IDAO, UIntStorage {
    bytes32 constant SELF_KEY = sha3(0x00, 0x00);
    bytes32 constant KERNAL_KEY = sha3(0x00, 0x01);
    uint32 constant RETURN_MEMORY_SIZE = 24 * 32;

    function setKernel(address kernelAddress) internal {
        storageSet(KERNAL_KEY, uint256(kernelAddress));
    }

    function setSelf(address selfAddress) internal {
        storageSet(SELF_KEY, uint256(selfAddress));
    }

    function getSelf() constant public returns (address) {
        return address(storageGet(SELF_KEY));
    }

    function getKernel() constant public returns (address) {
        return address(storageGet(KERNAL_KEY));
    }
}
