pragma solidity ^0.4.11;

import "../../contracts/kernel/organs/Organ.sol";

contract MockedOrgan is Organ {
  function organWasInstalled() {
    setReturnSize(bytes4(sha3('mock_getNumber()')), 32);
    setReturnSize(bytes4(sha3('mock_getSender()')), 32);
  }

  function mock_setNumber(uint256 i) payable {
    storageSet(sha3(0xbeef), i);
    storageSet(sha3(0xbeaf), uint256(dao_msg().sender));
  }

  function mock_getNumber() constant returns (uint256) {
    return storageGet(sha3(0xbeef));
  }

  function mock_getSender() constant returns (address) {
    return address(storageGet(sha3(0xbeaf)));
  }

  function canHandlePayload(bytes payload) public returns (bool) {
    return true;
  }

  function recover(bytes32 r, bytes32 s, uint8 v) constant returns (address) {
    return ecrecover(hashit(), v, r, s);
  }

  function hashit() constant returns (bytes32) {
    return sha3(0);
  }
}
