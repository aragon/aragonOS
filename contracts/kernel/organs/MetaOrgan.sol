pragma solidity ^0.4.8;

import "./DispatcherOrgan.sol";

contract MetaOrgan is DispatcherOrgan {
  function ceaseToExist() {
    selfdestruct(0xdead);
  }

  function replaceKernel(address newKernel) {
    kernel = newKernel;
  }

  function setEtherToken(address newToken) {
    etherToken = newToken;
  }

  function replaceOrgan(address organAddress, uint organN) {
    organs[organN] = organAddress;
    OrganReplaced(organAddress, organN);
  }

  function canHandlePayload(bytes payload) returns (bool) {
    bytes4 sig = getFunctionSignature(payload);
    return
      sig == 0x5bb95c74 || // ceaseToExist()
      sig == 0xcebe30ac || // replaceKernel(address)
      sig == 0x6ad419a8 || // setEtherToken(address)
      sig == 0x53900d7a;   // replaceOrgan(address,uint256)
  }
}
