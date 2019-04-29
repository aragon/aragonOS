pragma solidity 0.4.24;

import "../../apps/AragonApp.sol";


contract IssuesRegistry is AragonApp {
    bytes32 constant public SET_ENTRY_SEVERITY_ROLE = keccak256("SET_ENTRY_SEVERITY_ROLE");

    enum Severity { None, Low, Mid, High, Critical }

    mapping (address => Severity) internal issuesSeverity;

    event SeveritySet(address indexed entry, Severity severity, address sender);

    function initialize() public onlyInit {
        initialized();
    }

    function isSeverityFor(address entry) public view isInitialized returns (bool) {
        return issuesSeverity[entry] != Severity.None;
    }

    function getSeverityFor(address entry) public view isInitialized returns (Severity) {
        return issuesSeverity[entry];
    }

    function setSeverityFor(address entry, Severity severity) public authP(SET_ENTRY_SEVERITY_ROLE, arr(entry, msg.sender)) {
        issuesSeverity[entry] = severity;
        emit SeveritySet(entry, severity, msg.sender);
    }
}
