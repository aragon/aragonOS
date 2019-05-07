pragma solidity 0.4.24;

import "../apps/AragonApp.sol";
import "./IIssuesRegistry.sol";


contract IssuesRegistry is IIssuesRegistry, AragonApp {
    bytes32 constant public SET_SEVERITY_ROLE = keccak256("SET_SEVERITY_ROLE");

    mapping (address => Severity) internal issuesSeverity;

    function initialize() external onlyInit {
        initialized();
    }

    function setSeverityFor(address implementation, Severity severity) external authP(SET_SEVERITY_ROLE, arr(implementation)) {
        issuesSeverity[implementation] = severity;
        emit SeveritySet(implementation, severity, msg.sender);
    }

    function isSeverityFor(address implementation) public view isInitialized returns (bool) {
        return issuesSeverity[implementation] != Severity.None;
    }

    function getSeverityFor(address implementation) public view isInitialized returns (Severity) {
        return issuesSeverity[implementation];
    }
}
