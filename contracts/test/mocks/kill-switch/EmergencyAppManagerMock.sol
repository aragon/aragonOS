pragma solidity 0.4.24;

import "../../../kernel/Kernel.sol";
import "../../../apps/AragonApp.sol";


/**
* @title EmergencyAppManagerMock
* @dev This mock mimics a contract that is allowed to manage contract upgrades in emergency situations
*/
contract EmergencyAppManagerMock is AragonApp {
    bytes32 public constant APP_MANAGER_EMERGENCY_ROLE = keccak256("APP_MANAGER_EMERGENCY_ROLE");

    function initialize() external onlyInit {
        initialized();
    }

    function setAppOnEmergency(bytes32 _namespace, bytes32 _appId, address _app) public auth(APP_MANAGER_EMERGENCY_ROLE) {
        Kernel(kernel()).setAppOnEmergency(_namespace, _appId, _app);
    }
}


/**
* @title AppManagerMock
* @dev This mock mimics a contract that is allowed to manage contract upgrades in non-emergency situations
*/
contract AppManagerMock is AragonApp {
    bytes32 public constant APP_MANAGER_ROLE = keccak256("APP_MANAGER_ROLE");

    function initialize() external onlyInit {
        initialized();
    }

    function setApp(bytes32 _namespace, bytes32 _appId, address _app) public auth(APP_MANAGER_ROLE) {
        kernel().setApp(_namespace, _appId, _app);
    }
}
