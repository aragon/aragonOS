pragma solidity ^0.4.11;

contract AbstractKernel {
  event OrganReplaced(address organAddress, uint organN);

  function getOrgan(uint organN) returns (address organAddress);
  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool);

  struct DAOMessage {
    address sender; // 160 bits
    address token;  // 160 bits
    uint256 value;  // 256 bits
  } // = 3 sstore, with refund it is 15k gas per call

  // TODO: Bring back to life DAOMessage dao_msg;

  /*
  mapping (uint => address) organs;
  mapping (bytes32 => bool) usedSignatures;
  address public etherToken;
  */
}
