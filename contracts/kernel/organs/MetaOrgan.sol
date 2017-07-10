pragma solidity ^0.4.11;

import "./IOrgan.sol";
import "../../tokens/EtherToken.sol";

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is IOrgan {
  bytes32 constant etherTokenKey = sha3(0x01, 0x02);
  bytes32 constant permissionsOracleKey = sha3(0x01, 0x03);

  function organWasInstalled() {}

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

  function setEtherToken(address newToken) public {
    storageSet(etherTokenKey, uint256(newToken));
  }

  function installOrgan(address organAddress, uint organN) public {
    setOrgan(organN, organAddress);
    assert(organAddress.delegatecall(0xd11cf3cd)); // calls organWasInstalled()
    // TODO: DAOEvents OrganReplaced(organAddress, organN);
  }

  function setPermissionsOracle(address newOracle) {
    storageSet(permissionsOracleKey, uint256(newOracle));
  }

  function setOrgan(uint _organId, address _organAddress) {
    storageSet(storageKeyForOrgan(_organId), uint256(_organAddress));
  }

  function storageKeyForOrgan(uint _organId) internal returns (bytes32) {
    return sha3(0x01, 0x00, _organId);
  }

  function canHandlePayload(bytes payload) public returns (bool) {
    bytes4 sig = getFunctionSignature(payload);
    return
      sig == 0x5bb95c74 || // ceaseToExist()
      sig == 0xcebe30ac || // replaceKernel(address)
      sig == 0x6ad419a8 || // setEtherToken(address)
      sig == 0x080440a6 || // setPermissionsOracle(address)
      sig == 0xb61842bc;   // installOrgan(address,uint256)
  }
}
