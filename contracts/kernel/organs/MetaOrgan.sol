pragma solidity ^0.4.11;

import "./IOrgan.sol";
import "../../tokens/EtherToken.sol";
import "../KernelRegistry.sol";

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is IOrgan, KernelRegistry {
  bytes32 constant permissionsOracleKey = sha3(0x01, 0x03);

  function ceaseToExist() public {
    // Check it is called in DAO context and not from the outside which would
    // delete the organ logic from the EVM
    address self = getSelf();
    assert(this == self && self > 0);
    selfdestruct(0xdead);
  }

  function replaceKernel(address newKernel) public {
    setKernel(newKernel);
  }

  function setPermissionsOracle(address newOracle) {
    storageSet(permissionsOracleKey, uint256(newOracle));
  }

  function installApp(address appAddress, bytes4[] sigs) {
    register(appAddress, sigs, false);
  }

  function installOrgan(address organAddress, bytes4[] sigs) {
    register(organAddress, sigs, true);
  }

  function removeOrgan(bytes4[] sigs) {
    deregister(sigs, true);
  }

  function removeApp(bytes4[] sigs) {
    deregister(sigs, false);
  }
}
