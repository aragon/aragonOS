pragma solidity ^0.4.11;

import "./DAOStorage.sol";

// @dev DAO is the base contract on top of which all DAO lives.
// This is the only element of the DAO that is non-upgradeable
// Given the simplicity of this contract, it could be written in LLL and/or
// be formally proven.

contract DAO is DAOStorage {
  // @dev DAO constructor references to the DAO kernel and saves its own identity as self
  function DAO(address deployedKernel) {
    setKernel(deployedKernel);
    assert(deployedKernel.delegatecall(0xb2a80631, deployedKernel)); // setupOrgans(address)
    setSelf(this);
    assert(deployedKernel == getKernel());
  }

  // @dev All calls to the DAO are forwarded to the kernel with a delegatecall
  function () payable public {
    uint32 len = getReturnSize();
    address target = getKernel();
    assembly {
      calldatacopy(0x0, 0x0, calldatasize)
      let result := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0, len)
      jumpi(invalidJumpLabel, iszero(result))
      return(0, len)
    }
  }
}
