pragma solidity ^0.4.11;

import "../../dao/DAOStorage.sol";

contract Organ is DAOStorage {
  function canHandlePayload(bytes payload) returns (bool);

  function getFunctionSignature(bytes _d) public constant returns (bytes4 sig) {
    assembly { sig := mload(add(_d, 0x20)) }
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
    return true;
  }

  function getOrgan(uint _organId) returns (address organAddress) {
    return address(storageGet(getStorageKeyForOrgan(_organId)));
  }

  function getStorageKeyForOrgan(uint _organId) internal returns (bytes32) {
    return sha3(0x01, 0x00, _organId);
  }
}
