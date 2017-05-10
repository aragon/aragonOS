pragma solidity ^0.4.11;

import "./TokensOrgan.sol";
import "../../apps/AbstractApplication.sol";

contract ApplicationOrgan is TokensOrgan {
  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return true; // Asumes it is the last organ and all transactions are intercepted.
  }

  function getResponsiveApplication(bytes payload) returns (address) {
    uint i = 2; // First checked organ is 2, doesn't check itself.
    while (true) {
      address applicationAddress = applications[i];
      if (applicationAddress == 0) return 0;
      if (AbstractApplication(applicationAddress).canHandlePayload(payload)) return applicationAddress;
      i++;
    }
  }

  function installApplication(uint i, address application) {
    applications[i] = application;
    InstalledApplication(application);
  }

  function () {
    address responsiveApplication = getResponsiveApplication(msg.data);
    if (responsiveApplication == 0) throw;

    AbstractApplication app = AbstractApplication(responsiveApplication);
    app.setDAOMsg(dao_msg.sender, dao_msg.token, dao_msg.value); // check reentrancy risks
    if (!app.call(msg.data)) throw; // every app is sandboxed
  }

  mapping (uint => address) applications;
  event InstalledApplication(address applicationAddress);
}
