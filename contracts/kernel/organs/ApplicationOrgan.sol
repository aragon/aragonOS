pragma solidity ^0.4.11;

import "../../apps/AbstractApplication.sol";
import "./Organ.sol";

contract ApplicationOrgan is Organ {
  // AppOrgan intercepts all the calls
  function canHandlePayload(bytes payload) public returns (bool) {
    return true;
  }

  function organWasInstalled() {
    setReturnSize(0x24f3a51b, 32); // getApp(address)
  }

  function installApp(uint i, address application) {
    storageSet(getApplicationStorageKey(i), uint256(application));
    InstalledApplication(application);
  }

  function () public {
    address responsiveApplication = getResponsiveApplication(msg.data);
    assert(responsiveApplication > 0);

    AbstractApplication app = AbstractApplication(responsiveApplication);
    DAOMessage memory daomsg = dao_msg();
    app.setDAOMsg(daomsg.sender, daomsg.token, daomsg.value); // TODO: check reentrancy risks
    assert(app.call(msg.data)); // every app is sandboxed
  }

  function getApp(uint i) constant public returns (address) {
    return address(storageGet(getApplicationStorageKey(i)));
  }

  function getResponsiveApplication(bytes payload) returns (address) {
    uint i = 1;
    while (true) {
      address applicationAddress = getApp(i);
      if (applicationAddress == 0) return 0;  // if a 0 address is returned it means, there is no more apps.
      if (AbstractApplication(applicationAddress).canHandlePayload(payload)) return applicationAddress;
      i++;
    }
  }

  function getApplicationStorageKey(uint _appId) internal constant returns (bytes32) {
    return sha3(0x04, 0x00, _appId);
  }

  event InstalledApplication(address applicationAddress);
}
