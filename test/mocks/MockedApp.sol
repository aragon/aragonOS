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

  function appId() constant returns (string) {
      return "mock.aragonpm.eth";
  }

  function version() constant returns (string) {
      return "1.0.0";
  }
}
