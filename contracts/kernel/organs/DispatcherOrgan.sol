pragma solidity ^0.4.8;

import "./Organ.sol";

contract DispatcherOrgan is Organ {
  function canPerformAction(address sender, uint256 value, bytes data) returns (bool) {
    return true || sender == address(this) || oracleCanPerformAction(sender, value, data);
  }

  function oracleCanPerformAction(address sender, uint256 value, bytes data) internal returns (bool) {
    if (permissionsOracle == 0x0) return false;
    return DispatcherOrgan(permissionsOracle).canPerformAction(sender, value, data);
  }

  function setPermissionOracle(address newOracle) {
    permissionsOracle = newOracle;
  }

  function canHandlePayload(bytes payload) returns (bool) {
    return getResponsiveOrgan(payload) != 0;
  }

  function getResponsiveOrgan(bytes payload) returns (address) {
    uint i = 2; // First checked organ is 2, doesn't check itself.
    while (true) {
      address organAddress = getOrgan(i);
      if (organAddress == 0) return 0;
      if (Organ(organAddress).canHandlePayload(payload)) return organAddress;
      i++;
    }
  }

  function () payable {
    address responsiveOrgan = getResponsiveOrgan(msg.data);
    if (responsiveOrgan == 0) throw;
    if (!responsiveOrgan.delegatecall(msg.data)) throw;
  }

  address permissionsOracle;
}
