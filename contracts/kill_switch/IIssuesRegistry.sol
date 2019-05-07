pragma solidity 0.4.24;


contract IIssuesRegistry {
    enum Severity { None, Low, Mid, High, Critical }

    event SeveritySet(address indexed implementation, Severity severity, address sender);

    function setSeverityFor(address implementation, Severity severity) external;

    function isSeverityFor(address implementation) public view returns (bool);

    function getSeverityFor(address implementation) public view returns (Severity);
}
