pragma solidity ^0.4.11;

import "./TokensOrgan.sol";
import "../../apps/AbstractApplication.sol";

contract ApplicationOrgan is TokensOrgan {
  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return true; // Asumes it is the last organ and all transactions are intercepted.
  }

  function installApplication(uint i, address application) {
    applications[i] = application;
    InstalledApplication(application);
  }

  function () public {
    address responsiveApplication = getResponsiveApplication(msg.data);
    assert(responsiveApplication > 0);

    AbstractApplication app = AbstractApplication(responsiveApplication);
    app.setDAOMsg(dao_msg.sender, dao_msg.token, dao_msg.value); // TODO: check reentrancy risks
    assert(app.call(msg.data)); // every app is sandboxed
  }

  function getResponsiveApplication(bytes payload) returns (address) {
    uint i = 1; // First checked organ is 2, doesn't check itself.
    while (true) {
      address applicationAddress = applications[i];
      if (applicationAddress == 0) return 0;  // if a 0 address is returned it means, there is no more apps.
      if (AbstractApplication(applicationAddress).canHandlePayload(payload)) return applicationAddress;
      i++;
    }
  }

  mapping (uint => address) public applications;
  event InstalledApplication(address applicationAddress);
}
