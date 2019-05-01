pragma solidity 0.4.24;

import "./IKillSwitch.sol";
import "./IIssuesRegistry.sol";
import "../apps/AragonApp.sol";
import "../common/IsContract.sol";


contract KillSwitch is IKillSwitch, IsContract, AragonApp {
    bytes32 constant public SET_DEFAULT_ISSUES_REGISTRY_ROLE = keccak256("SET_DEFAULT_ISSUES_REGISTRY_ROLE");
    bytes32 constant public SET_ISSUES_REGISTRY_ROLE = keccak256("SET_ISSUES_REGISTRY_ROLE");
    bytes32 constant public SET_CONTRACT_ACTION_ROLE = keccak256("SET_CONTRACT_ACTION_ROLE");
    bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = keccak256("SET_HIGHEST_ALLOWED_SEVERITY_ROLE");

    string constant private ERROR_ISSUES_REGISTRY_NOT_CONTRACT = "KS_ISSUES_REGISTRY_NOT_CONTRACT";

    enum ContractAction { Check, Ignore, Deny }

    struct Settings {
        ContractAction action;
        IIssuesRegistry.Severity highestAllowedSeverity;
        IIssuesRegistry issuesRegistry;
    }

    IIssuesRegistry public defaultIssuesRegistry;
    mapping (address => Settings) internal contractSettings;

    event DefaultIssuesRegistrySet(address issuesRegistry);
    event ContractActionSet(address indexed contractAddress, ContractAction action);
    event IssuesRegistrySet(address indexed contractAddress, address issuesRegistry);
    event HighestAllowedSeveritySet(address indexed contractAddress, IIssuesRegistry.Severity severity);

    function initialize(IIssuesRegistry _defaultIssuesRegistry) external onlyInit {
        initialized();
        _setDefaultIssuesRegistry(_defaultIssuesRegistry);
    }

    function setDefaultIssuesRegistry(IIssuesRegistry _defaultIssuesRegistry)
        external
        authP(SET_DEFAULT_ISSUES_REGISTRY_ROLE, arr(msg.sender))
    {
        _setDefaultIssuesRegistry(_defaultIssuesRegistry);
    }

    function setContractAction(address _contract, ContractAction _action)
        external
        authP(SET_CONTRACT_ACTION_ROLE, arr(_contract, msg.sender))
    {
        contractSettings[_contract].action = _action;
        emit ContractActionSet(_contract, _action);
    }

    function setHighestAllowedSeverity(address _contract, IIssuesRegistry.Severity _severity)
        external
        authP(SET_HIGHEST_ALLOWED_SEVERITY_ROLE, arr(_contract, msg.sender))
    {
        contractSettings[_contract].highestAllowedSeverity = _severity;
        emit HighestAllowedSeveritySet(_contract, _severity);
    }

    function setIssuesRegistry(address _contract, IIssuesRegistry _issuesRegistry)
        external
        authP(SET_ISSUES_REGISTRY_ROLE, arr(_contract, msg.sender))
    {
        require(isContract(_issuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        contractSettings[_contract].issuesRegistry = _issuesRegistry;
        emit IssuesRegistrySet(_contract, address(_issuesRegistry));
    }

    function shouldDenyCallingContract(address _contract) external returns (bool) {
        // if the call should be denied, then deny given call
        if (isContractDenied(_contract)) {
            return true;
        }

        // if the contract issues are ignored, then allow given call
        if (isContractIgnored(_contract)) {
            return false;
        }

        // if the contract severity found is ignored, then allow given call
        if (isSeverityIgnored(_contract)) {
            return false;
        }

        // if none of the conditions above were met, then deny given call
        return true;
    }

    function getContractAction(address _contract) public view returns (ContractAction) {
        return contractSettings[_contract].action;
    }

    function getHighestAllowedSeverity(address _contract) public view returns (IIssuesRegistry.Severity) {
        return contractSettings[_contract].highestAllowedSeverity;
    }

    function getIssuesRegistry(address _contract) public view returns (IIssuesRegistry) {
        IIssuesRegistry foundRegistry = contractSettings[_contract].issuesRegistry;
        return foundRegistry == IIssuesRegistry(0) ? defaultIssuesRegistry : foundRegistry;
    }

    function isContractIgnored(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Ignore;
    }

    function isContractDenied(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Deny;
    }

    function isSeverityIgnored(address _contract) public view returns (bool) {
        IIssuesRegistry.Severity severityFound = getIssuesRegistry(_contract).getSeverityFor(_contract);
        IIssuesRegistry.Severity highestAllowedSeverity = getHighestAllowedSeverity(_contract);
        return highestAllowedSeverity >= severityFound;
    }

    function _setDefaultIssuesRegistry(IIssuesRegistry _defaultIssuesRegistry) internal {
        require(isContract(_defaultIssuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        defaultIssuesRegistry = _defaultIssuesRegistry;
        emit DefaultIssuesRegistrySet(address(_defaultIssuesRegistry));
    }
}
