pragma solidity ^0.4.11;

import "../dao/DAOStorage.sol";

contract IOrgan is DAOStorage {
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
}
