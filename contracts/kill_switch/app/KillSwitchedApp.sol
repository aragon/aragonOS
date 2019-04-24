pragma solidity 0.4.24;

import "./AppKillSwitch.sol";
import "../../apps/AragonApp.sol";


contract KillSwitchedApp is AragonApp {
    string private constant ERROR_CONTRACT_CALL_NOT_ALLOWED = "APP_CONTRACT_CALL_NOT_ALLOWED";

    AppKillSwitch internal appKillSwitch;

    modifier killSwitched {
        bool _isCallAllowed = !appKillSwitch.shouldDenyCallingContract(_baseApp(), address(this), msg.sender, msg.data, msg.value);
        require(_isCallAllowed, ERROR_CONTRACT_CALL_NOT_ALLOWED);
        _;
    }

    function initialize(AppKillSwitch _appKillSwitch) public onlyInit {
        initialized();
        appKillSwitch = _appKillSwitch;
    }

    function _baseApp() internal view returns (address) {
        return kernel().getApp(KERNEL_APP_BASES_NAMESPACE, appId());
    }
}
