pragma solidity ^0.4.11;

import "./IDAO.sol";


contract UIntStorage {
    mapping (bytes32 => uint256) uintStorage;

    function storageSet(bytes32 key, uint256 value) internal {
        uintStorage[key] = value;
    }

    function storageGet(bytes32 key) constant internal returns (uint256) {
        return uintStorage[key];
    }
}


contract DAOStorage is IDAO, UIntStorage {
    bytes32 constant KERNAL_KEY = sha3(0x00, 0x01);
    bytes32 constant SELF_KEY = sha3(0x00, 0x00);

    // dao_msg storage keys
    bytes32 constant SENDER_KEY = sha3(0x00, 0x02, 0x00);
    bytes32 constant TOKEN_KEY = sha3(0x00, 0x02, 0x01);
    bytes32 constant VALUE_KEY = sha3(0x00, 0x02, 0x02);

    uint32 constant RETURN_MEMORY_SIZE = 24 * 32;

    struct DAOMessage {
        address sender;
        address token;
        uint256 value;
    }

    function dao_msg() internal returns (DAOMessage) {
        return DAOMessage(
        address(storageGet(senderKey)),
        address(storageGet(tokenKey)),
        storageGet(valueKey)
        );
    }

    function setDAOMsg(DAOMessage dao_msg) internal {
        storageSet(senderKey, uint256(dao_msg.sender));
        storageSet(tokenKey, uint256(dao_msg.token));
        storageSet(valueKey, uint256(dao_msg.value));
    }

    function setKernel(address kernelAddress) internal {
        storageSet(kernelKey, uint256(kernelAddress));
    }

    function setSelf(address selfAddress) internal {
        storageSet(selfKey, uint256(selfAddress));
    }

    function getSelf() constant public returns (address) {
        return address(storageGet(selfKey));
    }

    function getKernel() constant public returns (address) {
        return address(storageGet(kernelKey));
    }
}
