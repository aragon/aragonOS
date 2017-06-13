pragma solidity ^0.4.8;

import "../../contracts/apps/bylaws/BylawOracle.sol";

contract BylawOracleMock is BylawOracle {
  bool allows;

  function BylawOracleMock(bool _allows) {
    allows = _allows;
  }

  function canPerformAction(address sender, bytes4 sig, bytes data, uint256 value) returns (bool ok, uint256 actionId) {
    return (allows, 0);
  }

  function performedAction(uint256 actionId) {
    throw;
  }
}
