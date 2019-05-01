pragma solidity 0.4.24;


contract IIssuesRegistry {
    enum Severity { None, Low, Mid, High, Critical }

    event SeveritySet(address indexed entry, Severity severity, address sender);

    function initialize() external;

    function setSeverityFor(address entry, Severity severity) external;

    function isSeverityFor(address entry) public view returns (bool);

    function getSeverityFor(address entry) public view returns (Severity);
}
