pragma solidity 0.4.24;


contract IIssuesRegistry {
    enum Severity { None, Low, Mid, High, Critical }

    event ChangeSeverity(address indexed implementation, Severity severity, address indexed sender);

    function setSeverityFor(address implementation, Severity severity) external;

    function hasSeverity(address implementation) public view returns (bool);

    function getSeverityFor(address implementation) public view returns (Severity);
}
