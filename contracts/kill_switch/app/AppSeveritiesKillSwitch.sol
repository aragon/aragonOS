pragma solidity 0.4.24;

import "./AppKillSwitch.sol";
import "../base/SeveritiesKillSwitch.sol";


contract AppSeveritiesKillSwitch is AppKillSwitch, SeveritiesKillSwitch {
    function setContractAction(address _contract, ContractAction _action)
        external
        authP(SET_CONTRACT_ACTION_ROLE, arr(_baseApp(), msg.sender))
    {
        _setContractAction(_contract, _action);
    }

    function setLowestAllowedSeverity(address _contract, IssuesRegistry.Severity _severity)
        external
        authP(SET_LOWEST_ALLOWED_SEVERITY_ROLE, arr(_baseApp(), msg.sender))
    {
        _setLowestAllowedSeverity(_contract, _severity);
    }
}
