pragma solidity ^0.4.11;

// @dev AbstractDAO defines the storage the DAO has.
// Contracts that will be delegate-called from the DAO need to inherit from
// AbstractDAO to ensure memory is correctly off-setted

contract AbstractDAO {
  function getSelf() constant public returns (address);
  function getKernel() constant public returns (address);
}
