pragma solidity ^0.4.8;

import "truffle/Assert.sol";

// Based on Simon de la Rouviere method: http://truffleframework.com/tutorials/testing-for-throws-in-solidity-tests

// Proxy contract for testing throws
contract ThrowProxy {
  address public target;
  bytes data;

  function ThrowProxy(address _target) {
    target = _target;
  }

  //prime the data using the fallback function.
  function() {
    data = msg.data;
  }

  function assertThrows(string msg) {
    Assert.isFalse(execute(), msg);
  }

  function assertItDoesntThrow(string msg) {
    Assert.isTrue(execute(), msg);
  }

  function execute() returns (bool) {
    return target.call(data);
  }
}
