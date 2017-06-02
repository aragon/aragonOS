pragma solidity ^0.4.11;

// import "../../apps/AbstractApplication.sol";
import "./Organ.sol";

contract AbstractApplication {
  function canHandlePayload(bytes payload) constant returns (bool);
  function setDAOMsg(address sender, address token, uint value);
}

contract ApplicationOrgan is Organ {
  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return true; // Asumes it is the last organ and all transactions are intercepted.
  }

  function installApplication(uint i, address application) {
    storageSet(getApplicationStorageKey(i), uint256(application));
    InstalledApplication(application);
  }

  function () public {
    address responsiveApplication = getResponsiveApplication(msg.data);
    assert(responsiveApplication > 0);

    AbstractApplication app = AbstractApplication(responsiveApplication);
    // app.setDAOMsg(dao_msg.sender, dao_msg.token, dao_msg.value); // TODO: check reentrancy risks
    assert(app.call(msg.data)); // every app is sandboxed
  }

  function getResponsiveApplication(bytes payload) returns (address) {
    uint i = 1; // First checked organ is 2, doesn't check itself.
    while (true) {
      address applicationAddress = address(storageGet(getApplicationStorageKey(i)));
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
