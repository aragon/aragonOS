pragma solidity ^0.4.11;

import "../AbstractDAOKernel.sol";

contract Organ is AbstractDAOKernel {
  function canHandlePayload(bytes payload) returns (bool);

  function getFunctionSignature(bytes _d) public constant returns (bytes4 sig) {
    assembly { sig := mload(add(_d, 0x20)) }
  }

  // Just to conform to lower protocols. This default implementations shouldn't be called.
  function getOrgan(uint organN) returns (address organAddress) {
    return organs[organN];
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return true;
  }
}
