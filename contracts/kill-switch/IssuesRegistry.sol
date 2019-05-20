pragma solidity 0.4.24;

import "../apps/AragonApp.sol";
import "./IIssuesRegistry.sol";


contract IssuesRegistry is IIssuesRegistry, AragonApp {
    bytes32 constant public CHANGE_SEVERITY_ROLE = keccak256("CHANGE_SEVERITY_ROLE");

    mapping (address => Severity) internal issuesSeverity;

    function initialize() external onlyInit {
        initialized();
    }

    function setSeverityFor(address implementation, Severity severity)
        external
        authP(CHANGE_SEVERITY_ROLE, arr(implementation, uint256(issuesSeverity[implementation]), uint256(severity)))
    {
        issuesSeverity[implementation] = severity;
        emit ChangeSeverity(implementation, severity, msg.sender);
    }

    function hasSeverity(address implementation) public view isInitialized returns (bool) {
        return issuesSeverity[implementation] != Severity.None;
    }

    function getSeverityFor(address implementation) public view isInitialized returns (Severity) {
        return issuesSeverity[implementation];
    }
}
