pragma solidity ^0.4.11;

import "../Application.sol";

contract StatusApp is Application {
  mapping (address => uint) public entityStatus;

  event EntityStatusChanged(address entity, uint8 status);

  function StatusApp(address _dao)
           Application(_dao) {}

  function setEntityStatus(address entity, uint8 status)
           onlyDAO public {
    entityStatus[entity] = status;
    EntityStatusChanged(entity, status);
  }
}
