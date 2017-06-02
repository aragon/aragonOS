pragma solidity ^0.4.11;

import "./Organ.sol";

// @dev This organ is responsible for finding what is the first organ that can perform an action
// and dispatching it.
contract DispatcherOrgan is Organ {
  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return true;
    // return sender == address(this) || oracleCanPerformAction(sender, token, value, data);
  }

  function performedAction(address sender, address token, uint256 value, bytes data) {
    return DispatcherOrgan(permissionsOracle()).performedAction(sender, token, value, data);
  }

  function oracleCanPerformAction(address sender, address token, uint256 value, bytes data) internal returns (bool) {
    if (permissionsOracle() == 0x0) return true; // if no one has been set to ask, allow it
    return DispatcherOrgan(permissionsOracle()).canPerformAction(sender, token, value, data);
  }

  function permissionsOracle() constant returns (address) {
    return address(storageGet(getStorageKeyForPermissionsOracle()));
  }

  function setPermissionOracle(address newOracle) {
    storageSet(getStorageKeyForPermissionsOracle(), uint256(newOracle));
  }

  function getStorageKeyForPermissionsOracle() constant returns (bytes32) {
    return sha3(0x02, 0x00);
  }

  function canHandlePayload(bytes payload) returns (bool) {
    return getResponsiveOrgan(payload) != 0;
  }

  function () public {
    address responsiveOrgan = getResponsiveOrgan(msg.data);
    assert(responsiveOrgan > 0); // assert that there is an organ capable of performing the action
    assert(responsiveOrgan.delegatecall(msg.data)); // delegate call to selected organ
  }

  function getResponsiveOrgan(bytes payload) returns (address) {
    uint i = 2; // First checked organ is 2, doesn't check itself.
    while (true) {
      address organAddress = getOrgan(i);
      if (organAddress == 0) return 0;  // if a 0 address is returned it means, there is no more organs.
      if (Organ(organAddress).canHandlePayload(payload)) return organAddress; // If the organ can handle it, return.
      i++;
    }
  }
}
