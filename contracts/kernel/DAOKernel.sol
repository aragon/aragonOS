pragma solidity ^0.4.8;

import "./AbstractDAOKernel.sol";
import "./organs/DispatcherOrgan.sol";
import "./organs/MetaOrgan.sol";

contract DAOKernel is AbstractDAOKernel {
  function DAOKernel() {
    organs[1] = address(new DispatcherOrgan());
    organs[2] = address(new MetaOrgan());
  }

  function getOrgan(uint organN) returns (address organAddress) {
    return organs[organN];
  }

  function getDispatcherOrgan() internal returns (DispatcherOrgan) {
    return DispatcherOrgan(getOrgan(1));
  }

  function canPerformAction(address sender, uint256 value, bytes data) returns (bool) {
    return getDispatcherOrgan().canPerformAction(sender, value, data);
  }

  function () payable {
    if (!canPerformAction(msg.sender, msg.value, msg.data)) throw;
    if (!getDispatcherOrgan().delegatecall(msg.data)) throw;
  }
}
