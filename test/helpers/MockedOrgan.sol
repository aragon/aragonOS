pragma solidity ^0.4.11;

import "../../contracts/kernel/organs/Organ.sol";

contract MockedOrgan is Organ {
  function organWasInstalled() {
    setReturnSize(bytes4(sha3('mock_getNumber()')), 32);
  }

  function mock_setNumber(uint256 i) {
    storageSet(sha3(0xbeef), i);
  }

  function mock_getNumber() returns (uint256) {
    return storageGet(sha3(0xbeef));
  }

  function canHandlePayload(bytes payload) public returns (bool) {
    bytes4 sig = getFunctionSignature(payload);
    return sig == sha3('mock_getNumber()') || sig == sha3('mock_setNumber(uint256)');
  }
}
