pragma solidity 0.4.24;

import "../base/KillSwitch.sol";


contract AppKillSwitch is AragonApp, KillSwitch {
    function initialize(IssuesRegistry _issuesRegistry) public onlyInit {
        initialized();
        _setIssuesRegistry(_issuesRegistry);
    }

    function _baseApp() internal view returns (address) {
        return kernel().getApp(KERNEL_APP_BASES_NAMESPACE, appId());
    }
}
