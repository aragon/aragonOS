pragma solidity 0.4.24;

import "./KillSwitch.sol";
import "./IssuesRegistry.sol";


contract BinaryKillSwitch is KillSwitch {
    function isSeverityIgnored(address /*_contract*/, IssuesRegistry.Severity _severity) public view returns (bool) {
        return _severity == IssuesRegistry.Severity.None;
    }
}
