pragma solidity ^0.4.6;

import "../AbstractCompany.sol";

contract Vote {
  mapping (uint8 => string) options;
  bool private allowsModification;

  function Vote() {
    allowsModification = true;
  }

  function lockVote() {
    allowsModification = false;
  }

  function addOption(uint8 id, string option) {
    if (!allowsModification) throw;
    options[id] = option;
  }

  function executeOnAction(uint8 option, AbstractCompany company);

  function () {
    throw;
  }
}
