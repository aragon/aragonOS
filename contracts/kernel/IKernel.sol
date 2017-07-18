pragma solidity ^0.4.11;

contract IKernel {
  event OrganReplaced(address organAddress, uint organN);

  function getOrgan(uint organN) constant returns (address organAddress);
  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool);

  // TODO: Bring back to life DAOMessage dao_msg;
}
