pragma solidity 0.4.24;

import "../../../kill-switch/KillSwitch.sol";


contract RevertingKillSwitchMock is KillSwitch {
    string private constant ERROR_MESSAGE = "KILL_SWITCH_REVERTED!";

    function shouldDenyCallingApp(bytes32 _appId, address _base, address _instance) external view returns (bool) {
        revert(ERROR_MESSAGE);
    }

    function shouldDenyCallingBaseApp(bytes32 _appId, address _base) public view returns (bool) {
        revert(ERROR_MESSAGE);
    }
}
