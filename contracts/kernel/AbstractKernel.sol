pragma solidity ^0.4.11;

contract AbstractKernel {
  event OrganReplaced(address organAddress, uint organN);

  function getOrgan(uint organN) constant returns (address organAddress);
  function getEtherToken() constant returns (address);
  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool);

  struct DAOMessage {
    address sender; // 160 bits
    address token;  // 160 bits
    uint256 value;  // 256 bits
  } // = 3 sstore, with refund it is 15k gas per call

  // TODO: Bring back to life DAOMessage dao_msg;
}
