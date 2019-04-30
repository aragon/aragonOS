pragma solidity 0.4.24;

import "./KillSwitch.sol";
import "../apps/AragonApp.sol";


contract KillSwitchedApp is AragonApp {
    string private constant ERROR_CONTRACT_CALL_NOT_ALLOWED = "APP_CONTRACT_CALL_NOT_ALLOWED";

    KillSwitch internal killSwitch;

    modifier killSwitched {
        bool _isCallAllowed = !killSwitch.shouldDenyCallingContract(_baseApp(), address(this), msg.sender, msg.data, msg.value);
        require(_isCallAllowed, ERROR_CONTRACT_CALL_NOT_ALLOWED);
        _;
    }

    function initialize(KillSwitch _killSwitch) public onlyInit {
        initialized();
        killSwitch = _killSwitch;
    }

    function _baseApp() internal view returns (address) {
        return kernel().getApp(KERNEL_APP_BASES_NAMESPACE, appId());
    }
}
