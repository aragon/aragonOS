pragma solidity ^0.4.8;

import "../dao/AbstractDAO.sol";

contract AbstractDAOKernel is AbstractDAO {
  // is AbstractDAO so it inherits DAO's storage

  event OrganReplaced(address organAddress, uint organN);

  function getOrgan(uint organN) returns (address organAddress);
  function canPerformAction(address sender, uint256 value, bytes data) returns (bool);

  mapping (uint => address) organs;
  mapping (bytes32 => bool) usedSignatures;
}
