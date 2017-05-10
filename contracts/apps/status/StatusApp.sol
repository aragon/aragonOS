pragma solidity ^0.4.11;

import "../Application.sol";

contract StatusApp is Application {
  enum EntityStatus {
    Base,
    Employee,
    Executive,
    God
  }

  mapping (address => uint8) public entityStatus;

  event EntityStatusChanged(address entity, uint8 status);

  function StatusApp(address _dao)
           Application(_dao) {}

  function setEntityStatusByStatus(address entity, uint8 status)
           onlyDAO public {
    require(entityStatus[dao_msg.sender] >= status); // Cannot set higher status
    require(entity == dao_msg.sender || entityStatus[entity] < entityStatus[dao_msg.sender]); // Cannot change status of higher status

    // Exec can set and remove employees.
    // Someone with lesser or same status cannot change ones status
    setStatus(entity, status);
  }

  function setEntityStatus(address entity, uint8 status)
           onlyDAO public {
    setStatus(entity, status);
  }

  function setStatus(address entity, uint8 status) internal {
    entityStatus[entity] = status;
    EntityStatusChanged(entity, status);
  }
}
