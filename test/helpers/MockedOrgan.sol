pragma solidity ^0.4.11;

import "../../contracts/kernel/organs/Organ.sol";

contract MockedOrgan is Organ {
  function organWasInstalled() {
    setReturnSize(bytes4(sha3('mock_getNumber()')), 32);
  }

  function mock_setNumber(uint256 i) payable {
    storageSet(sha3(0xbeef), i);
  }

  function mock_getNumber() constant returns (uint256) {
    return storageGet(sha3(0xbeef));
  }

  function canHandlePayload(bytes payload) public returns (bool) {
    return true;
  }
}
