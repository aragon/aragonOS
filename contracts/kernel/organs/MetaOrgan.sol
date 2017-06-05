pragma solidity ^0.4.11;

import "./Organ.sol";

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is Organ {
  bytes32 constant etherTokenKey = sha3(0x01, 0x02);

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

  function getEtherToken() constant returns (address) {
    return address(storageGet(etherTokenKey));
  }

  function replaceOrgan(address organAddress, uint organN) public {
    setOrgan(organN, organAddress);
    // TODO: DAOEvents OrganReplaced(organAddress, organN);
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
      sig == 0x877d08ee || // getEtherToken()
      sig == 0x53900d7a;   // replaceOrgan(address,uint256)
  }
}
