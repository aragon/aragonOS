pragma solidity ^0.4.11;

import "./DispatcherOrgan.sol";

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is DispatcherOrgan {
  function ceaseToExist() public {
    // Check it is called in DAO context and not from the outside which would
    // delete the organ logic from the EVM
    if (this != self || self == 0) throw;
    selfdestruct(0xdead);
  }

  function replaceKernel(address newKernel) public {
    kernel = newKernel;
  }

  function setEtherToken(address newToken) public {
    etherToken = newToken;
  }

  function replaceOrgan(address organAddress, uint organN) public {
    organs[organN] = organAddress;
    OrganReplaced(organAddress, organN);
  }

  function canHandlePayload(bytes payload) returns (bool) public {
    bytes4 sig = getFunctionSignature(payload);
    return
      sig == 0x5bb95c74 || // ceaseToExist()
      sig == 0xcebe30ac || // replaceKernel(address)
      sig == 0x6ad419a8 || // setEtherToken(address)
      sig == 0x53900d7a;   // replaceOrgan(address,uint256)
  }
}
