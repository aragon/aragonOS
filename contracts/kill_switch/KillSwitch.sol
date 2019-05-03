pragma solidity 0.4.24;

import "./IKillSwitch.sol";
import "./IIssuesRegistry.sol";
import "../apps/AragonApp.sol";
import "../common/IsContract.sol";


contract KillSwitch is IKillSwitch, IsContract, AragonApp {
    /*
     * Hardcoded constants to save gas
     * bytes32 constant public SET_DEFAULT_ISSUES_REGISTRY_ROLE = keccak256("SET_DEFAULT_ISSUES_REGISTRY_ROLE");
     * bytes32 constant public SET_ISSUES_REGISTRY_ROLE = keccak256("SET_ISSUES_REGISTRY_ROLE");
     * bytes32 constant public SET_CONTRACT_ACTION_ROLE = keccak256("SET_CONTRACT_ACTION_ROLE");
     * bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = keccak256("SET_HIGHEST_ALLOWED_SEVERITY_ROLE");
     */

    bytes32 constant public SET_DEFAULT_ISSUES_REGISTRY_ROLE = 0xec32b556caaf18ff28362d6b89f3f678177fb74ae2c5c78bfbac6b1dedfa6b43;
    bytes32 constant public SET_ISSUES_REGISTRY_ROLE = 0xc347b194ad4bc72077d417e05508bb224b4be509950d86cc7756e39a78fb725b;
    bytes32 constant public SET_CONTRACT_ACTION_ROLE = 0xc7e0b4d70cab2a2679fe330e7c518a6e245cc494b086c284bfeb5f5d03fbe3f6;
    bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = 0xca159ccee5d02309b609308bfc70aecedaf2d2023cd19f9c223d8e9875a256ba;

    string constant private ERROR_ISSUES_REGISTRY_NOT_CONTRACT = "KS_ISSUES_REGISTRY_NOT_CONTRACT";

    enum ContractAction { Allow, Check, Deny }

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
        auth(SET_DEFAULT_ISSUES_REGISTRY_ROLE)
    {
        _setDefaultIssuesRegistry(_defaultIssuesRegistry);
    }

    function setContractAction(address _contract, ContractAction _action)
        external
        authP(SET_CONTRACT_ACTION_ROLE, arr(_contract))
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
        authP(SET_ISSUES_REGISTRY_ROLE, arr(_contract))
    {
        require(isContract(_issuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        contractSettings[_contract].issuesRegistry = _issuesRegistry;
        emit IssuesRegistrySet(_contract, address(_issuesRegistry));
    }

    function shouldDenyCallingContract(address _contract) external returns (bool) {
        // if the contract is denied, then deny given call
        if (isContractDenied(_contract)) {
            return true;
        }

        // if the contract is allowed, then allow given call
        if (isContractAllowed(_contract)) {
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

    function isContractAllowed(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Allow;
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
