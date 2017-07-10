pragma solidity ^0.4.11;

contract BylawOracle {
  function canPerformAction(address sender, bytes data, address token, uint256 value) returns (bool ok, uint256 actionId);
  function performedAction(uint256 actionId);
}
