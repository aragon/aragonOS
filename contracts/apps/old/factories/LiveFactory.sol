pragma solidity ^0.4.8;

contract LiveFactory {
  function deployCode(bytes _code) returns (address deployedAddress) {
    assembly {
      deployedAddress := create(0, add(_code, 0x20), mload(_code))
      jumpi(invalidJumpLabel, iszero(extcodesize(deployedAddress))) // jumps if no code at addresses
    }
    ContractDeployed(deployedAddress);
  }

  event ContractDeployed(address deployedAddress);
}
