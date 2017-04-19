pragma solidity ^0.4.8;

import "./TokensOrgan.sol";

contract Application {
  function canHandlePayload(bytes payload);
}

contract ApplicationOrgan is TokensOrgan {
  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return true; // Asumes it is the last organ and all transactions are intercepted.
  }

  function getResponsiveApplication(bytes payload) returns (address) {
    uint i = 2; // First checked organ is 2, doesn't check itself.
    while (true) {
      address applicationAddress = applications[i];
      if (applicationAddress == 0) return 0;
      if (Application(applicationAddress).canHandlePayload(payload)) return applicationAddress;
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
    if (!responsiveApplication.delegatecall(msg.data)) throw;
  }

  mapping (uint => address) applications;
  event InstalledApplication(address applicationAddress);
}
