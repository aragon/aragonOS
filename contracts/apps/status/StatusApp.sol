pragma solidity ^0.4.11;

import "../Application.sol";
import "./IStatusApp.sol";

contract StatusApp is IStatusApp, Application {
    mapping (address => uint) entityStatus;

    event EntityStatusChanged(address entity, uint8 status);

    function StatusApp(address _dao)
                     Application(_dao) {}

    function setEntityStatus(address entity, uint8 status) onlyDAO external
    {
        entityStatus[entity] = status;
        EntityStatusChanged(entity, status);
    }

    function getEntityStatus(address entity) constant public returns (uint) {
        return entityStatus[entity];
    }
}
