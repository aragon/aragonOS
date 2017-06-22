pragma solidity ^0.4.11;

// @dev IDAO defines the storage the DAO has.

contract IDAO {
  function getSelf() constant public returns (address);
  function getKernel() constant public returns (address);
}
