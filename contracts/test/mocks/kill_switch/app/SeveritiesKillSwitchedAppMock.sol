pragma solidity 0.4.24;

import "./AppKillSwitchedAppMock.sol";
import "../../../../kill_switch/app/AppSeveritiesKillSwitch.sol";


contract AppSeveritiesKillSwitchMock is AppSeveritiesKillSwitch {
    function _shouldEvaluateCall(address /*_base*/, address _instance, address _sender, bytes _data, uint256 /*_value*/) internal returns (bool) {
        bytes4 methodID;
        assembly { methodID := mload(add(_data, 0x20)) }

        // since this will act for every tx of the app, we provide a whitelist of functions
        AppKillSwitchedAppMock app = AppKillSwitchedAppMock(_instance);

        // if called method is #reset, and the sender is the owner, do not evaluate
        if (methodID == app.reset.selector && _sender == app.owner()) return false;

        // evaluate otherwise
        return true;
    }
}
