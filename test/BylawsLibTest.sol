pragma solidity ^0.4.8;

import "truffle/Assert.sol";
import "../contracts/bylaws/BylawsLib.sol";

import "./helpers/ThrowProxy.sol";

contract BylawsLibTest {
  ThrowProxy throwProxy;

  function beforeAll() {
  }

  function beforeEach() {
    throwProxy = new ThrowProxy(address(this));
  }

  function testNotTests() {
    Assert.isTrue(false, "Please test me");
  }
}
