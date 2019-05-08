pragma solidity 0.4.24;

import "../../../kill_switch/KillSwitch.sol";


contract FailingKillSwitchMock is KillSwitch {
    string private constant ERROR_FAIL = "KILL_SWITCH_FAIL!";

    function shouldDenyCallingApp(bytes32 _appId, address _base, address _instance) external returns (bool) {
        revert(ERROR_FAIL);
    }
}
