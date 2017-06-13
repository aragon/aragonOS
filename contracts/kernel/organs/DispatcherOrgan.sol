pragma solidity ^0.4.11;

import "./Organ.sol";
import "../../dao/DAOStorage.sol";

// @dev This organ is responsible for finding what is the first organ that can perform an action
// and dispatching it.
contract DispatcherOrgan is Organ {
  function organWasInstalled() {
    setReturnSize(0xb18fe4f3, 32); // canPerformAction(...): returns 1 bool (ABI encoded to 32 bytes)
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
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

  function () payable public {
    address responsiveOrgan = getResponsiveOrgan(msg.data);
    assert(responsiveOrgan > 0); // assert that there is an organ capable of performing the action
    address target = responsiveOrgan;
    uint32 len = getReturnSize(msg.sig);

    assembly {
      calldatacopy(0x0, 0x0, calldatasize)
      let result := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0, len)
      jumpi(invalidJumpLabel, iszero(result))
      return(0, len)
    }
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
