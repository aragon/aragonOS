pragma solidity ^0.4.11;

/**
* @author Jorge Izquierdo (Aragon)
* @description StatusApp is a very basic app that keeps track of numeric status for entities
*/

import "../Application.sol";
import "./IStatusApp.sol";

contract StatusApp is IStatusApp, Application {
    mapping (address => uint) entityStatus;

    function StatusApp(address _dao)
                     Application(_dao) {}

    function appId() constant returns (string) {
        return "status.aragonpm.eth";
    }

    function version() constant returns (string) {
        return "1.0.0";
    }

    /**
    * @dev Assign status `_status` to `_entity`
    * @param _entity Address of the entity being modified
    * @param _status New status for entity
    */
    function setEntityStatus(address _entity, uint8 _status) onlyDAO external {
        entityStatus[_entity] = _status;
        ChangeEntityStatus(_entity, _status);
    }

    function getEntityStatus(address entity) constant public returns (uint) {
        return entityStatus[entity];
    }
}
