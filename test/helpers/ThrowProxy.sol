pragma solidity ^0.4.18;

import "truffle/Assert.sol";

// Based on Simon de la Rouviere method: http://truffleframework.com/tutorials/testing-for-throws-in-solidity-tests


// Proxy contract for testing throws
contract ThrowProxy {
  address public target;
  bytes data;

  function ThrowProxy(address _target) public {
    target = _target;
  }

  //prime the data using the fallback function.
  function() public {
    data = msg.data;
  }

  function assertThrows(string _msg) public {
    Assert.isFalse(execute(), _msg);
  }

  function assertItDoesntThrow(string _msg) public {
    Assert.isTrue(execute(), _msg);
  }

  function execute() public returns (bool) {
    return target.call(data);
  }
}
