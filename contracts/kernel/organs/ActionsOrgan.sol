pragma solidity ^0.4.11;

import "./IOrgan.sol";


contract ActionsOrgan is IOrgan {
    function performAction(address to, bytes data) returns (bool) {
        return to.call(data); // performs action with DAO as msg.sender
    }

    function organWasInstalled() {}

    function canHandlePayload(bytes payload) public returns (bool) {
        return getFunctionSignature(payload) == 0x4036176a; // performAction(address,bytes)
    }
}
