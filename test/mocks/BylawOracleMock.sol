pragma solidity ^0.4.8;

import "../../contracts/apps/bylaws/BylawOracle.sol";

contract BylawOracleMock is BylawOracle {
  bool allows;

  function changeAllow(bool _allows) {
    allows = _allows;
  }

  function canPerformAction(address sender, bytes data, address token, uint256 value) returns (bool ok, uint256 actionId) {
    return (allows, 0);
  }

  function performedAction(uint256 actionId) {
    throw;
  }
}
