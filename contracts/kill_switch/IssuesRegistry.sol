pragma solidity 0.4.24;

import "../apps/AragonApp.sol";
import "./IIssuesRegistry.sol";


contract IssuesRegistry is IIssuesRegistry, AragonApp {
    bytes32 constant public SET_ENTRY_SEVERITY_ROLE = keccak256("SET_ENTRY_SEVERITY_ROLE");

    mapping (address => Severity) internal issuesSeverity;

    function initialize() external onlyInit {
        initialized();
    }

    function setSeverityFor(address entry, Severity severity) external authP(SET_ENTRY_SEVERITY_ROLE, arr(entry)) {
        issuesSeverity[entry] = severity;
        emit SeveritySet(entry, severity, msg.sender);
    }

    function isSeverityFor(address entry) public view isInitialized returns (bool) {
        return issuesSeverity[entry] != Severity.None;
    }

    function getSeverityFor(address entry) public view isInitialized returns (Severity) {
        return issuesSeverity[entry];
    }
}
