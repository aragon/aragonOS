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
    bytes32 constant KERNEL_KEY = sha3(0x00, 0x01);
    bytes32 constant SELF_KEY = sha3(0x00, 0x00);

    // dao_msg storage keys
    bytes32 constant SENDER_KEY = sha3(0x00, 0x02, 0x00);
    bytes32 constant TOKEN_KEY = sha3(0x00, 0x02, 0x01);
    bytes32 constant VALUE_KEY = sha3(0x00, 0x02, 0x02);

    struct DAOMessage {
        address sender;
        address token;
        uint256 value;
    }

    function dao_msg() internal returns (DAOMessage) {
        return DAOMessage(
            address(storageGet(SENDER_KEY)),
            address(storageGet(TOKEN_KEY)),
            storageGet(VALUE_KEY)
        );
    }

    function setDAOMsg(DAOMessage dao_msg) internal {
        storageSet(SENDER_KEY, uint256(dao_msg.sender));
        storageSet(TOKEN_KEY, uint256(dao_msg.token));
        storageSet(VALUE_KEY, uint256(dao_msg.value));
    }

    function setKernel(address kernelAddress) internal {
        storageSet(KERNEL_KEY, uint256(kernelAddress));
    }

    function setSelf(address selfAddress) internal {
        storageSet(SELF_KEY, uint256(selfAddress));
    }

    function getSelf() constant public returns (address) {
        return address(storageGet(SELF_KEY));
    }

    function getKernel() constant public returns (address) {
        return address(storageGet(KERNEL_KEY));
    }

    function getReturnSize() internal constant returns (uint32) {
        return 8 * 32; // allows for 10 values returned
    }
}
