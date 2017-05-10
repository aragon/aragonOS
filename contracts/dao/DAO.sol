pragma solidity ^0.4.11;

import "./AbstractDAO.sol";
import "../kernel/Kernel.sol";

// @dev DAO is the base contract on top of which all DAO lives.
// This is the only element of the DAO that is non-upgradeable
// Given the simplicity of this contract, it could be written in LLL and/or
// be formally proven.

contract DAO is AbstractDAO {
  // @dev DAO constructor deploys its DAO kernel and saves its own identity as self
  function DAO() {
    kernel = address(new Kernel());
    self = address(this);
  }

  // @dev All calls to the DAO are forwarded to the kernel with a delegatecall
  function () payable public {
    assert(kernel.delegatecall(msg.data)); // In case the call fails, revert state.
  }
}
