pragma solidity ^0.4.11;

import "./IOrgan.sol";
import "../../tokens/EtherToken.sol";

contract FunctionRegistry is DAOStorage {
  function get(bytes4 _sig) constant returns (address, bool) {
    uint v = storageGet(storageKeyForSig(_sig));
    bool isDelegate = v >> 8 * 20 == 1;
    return (address(v), isDelegate);
  }

  function storageKeyForSig(bytes4 _sig) internal returns (bytes32) {
    return sha3(0x01, 0x00, _sig);
  }

  function register(address impl, bytes4[] sigs, bool delegate) internal {
    uint addDelegate = delegate ? 2 ** 8 ** 20 : 0;
    storageSet(storageKeyForSig(bytes4(sha3(sigs))), identifier(delegate));

    for (uint i = 0; i < sigs.length; i++) {
      require(delegate || storageGet(storageKeyForSig(sigs[i])) == 0); // don't allow to overwrite on apps
      storageSet(storageKeyForSig(sigs[i]), uint(address(impl)) + addDelegate);
    }
  }

  function identifier(bool isDelegate) internal returns (uint) {
    return isDelegate ? 2 : 1;
  }
}

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is IOrgan, FunctionRegistry {
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

  function deregister(bytes4[] sigs, bool delegate) internal {
    // performs integrity check (all sigs being removed) and allows double auth for organs or apps
    require(storageGet(storageKeyForSig(bytes4(sha3(sigs)))) == identifier(delegate));
    for (uint i = 0; i < sigs.length; i++)
      storageSet(storageKeyForSig(sigs[i]), 0);
  }
}
