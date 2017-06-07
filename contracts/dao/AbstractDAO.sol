pragma solidity ^0.4.11;

// @dev AbstractDAO defines the storage the DAO has.

contract AbstractDAO {
  function getSelf() constant public returns (address);
  function getKernel() constant public returns (address);
}
