pragma solidity 0.4.24;

import "./AppKillSwitch.sol";
import "../base/SeveritiesKillSwitch.sol";


contract AppSeveritiesKillSwitch is AppKillSwitch, SeveritiesKillSwitch {
    function setLowestAllowedSeverity(address _contract, IssuesRegistry.Severity _severity)
        external
        authP(SET_LOWEST_ALLOWED_SEVERITY_ROLE, arr(_baseApp(), msg.sender))
    {
        _setLowestAllowedSeverity(_contract, _severity);
    }
}
