pragma solidity ^0.4.13;

import "../../contracts/apps/Application.sol";

contract MockedApp is Application {
  bool public didStuff;

  function MockedApp(address dao_addr) Application(dao_addr) {}

  function doStuff() onlyDAO {
    didStuff = true;
  }

  function unprotectedDoStuff() {
    didStuff = true;
  }

  function canHandlePayload(bytes p) constant returns (bool) {
    return true; // can handle all the payloads
  }
}
