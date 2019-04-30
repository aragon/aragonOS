pragma solidity 0.4.24;

import "./IssuesRegistry.sol";
import "../common/IsContract.sol";


contract KillSwitch is IsContract, AragonApp {
    bytes32 constant public SET_DEFAULT_ISSUES_REGISTRY_ROLE = keccak256("SET_DEFAULT_ISSUES_REGISTRY_ROLE");
    bytes32 constant public SET_ISSUES_REGISTRY_ROLE = keccak256("SET_ISSUES_REGISTRY_ROLE");
    bytes32 constant public SET_CONTRACT_ACTION_ROLE = keccak256("SET_CONTRACT_ACTION_ROLE");
    bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = keccak256("SET_HIGHEST_ALLOWED_SEVERITY_ROLE");

    string constant private ERROR_ISSUES_REGISTRY_NOT_CONTRACT = "KS_ISSUES_REGISTRY_NOT_CONTRACT";

    enum ContractAction { Check, Ignore, Deny }

    struct Settings {
        ContractAction action;
        IssuesRegistry.Severity highestAllowedSeverity;
        IssuesRegistry issuesRegistry;
    }

    IssuesRegistry public defaultIssuesRegistry;
    mapping (address => Settings) internal contractSettings;

    event DefaultIssuesRegistrySet(address issuesRegistry);
    event ContractActionSet(address indexed contractAddress, ContractAction action);
    event IssuesRegistrySet(address indexed contractAddress, address issuesRegistry);
    event HighestAllowedSeveritySet(address indexed contractAddress, IssuesRegistry.Severity severity);

    function initialize(IssuesRegistry _defaultIssuesRegistry) external onlyInit {
        initialized();
        _setDefaultIssuesRegistry(_defaultIssuesRegistry);
    }

    function setDefaultIssuesRegistry(IssuesRegistry _defaultIssuesRegistry)
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

    function setHighestAllowedSeverity(address _contract, IssuesRegistry.Severity _severity)
        external
        authP(SET_HIGHEST_ALLOWED_SEVERITY_ROLE, arr(_contract, msg.sender))
    {
        contractSettings[_contract].highestAllowedSeverity = _severity;
        emit HighestAllowedSeveritySet(_contract, _severity);
    }

    function setIssuesRegistry(address _contract, IssuesRegistry _issuesRegistry)
        external
        authP(SET_ISSUES_REGISTRY_ROLE, arr(_contract, msg.sender))
    {
        require(isContract(_issuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        contractSettings[_contract].issuesRegistry = _issuesRegistry;
        emit IssuesRegistrySet(_contract, address(_issuesRegistry));
    }

    function getContractAction(address _contract) public view returns (ContractAction) {
        return contractSettings[_contract].action;
    }

    function getHighestAllowedSeverity(address _contract) public view returns (IssuesRegistry.Severity) {
        return contractSettings[_contract].highestAllowedSeverity;
    }

    function getIssuesRegistry(address _contract) public view returns (IssuesRegistry) {
        IssuesRegistry foundRegistry = contractSettings[_contract].issuesRegistry;
        return foundRegistry == IssuesRegistry(0) ? defaultIssuesRegistry : foundRegistry;
    }

    function isContractIgnored(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Ignore;
    }

    function isContractDenied(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Deny;
    }

    function isSeverityIgnored(address _contract) public view returns (bool) {
        IssuesRegistry.Severity severityFound = getIssuesRegistry(_contract).getSeverityFor(_contract);
        IssuesRegistry.Severity highestAllowedSeverity = getHighestAllowedSeverity(_contract);
        return highestAllowedSeverity >= severityFound;
    }

    function shouldDenyCallingContract(address _base, address _instance, address _sender, bytes _data, uint256 _value) public returns (bool) {
        // if the call should not be evaluated, then allow given call
        if (!_shouldEvaluateCall(_base, _instance, _sender, _data, _value)) {
            return false;
        }

        // if the call should be denied, then deny given call
        if (isContractDenied(_base)) {
            return true;
        }

        // if the contract issues are ignored, then allow given call
        if (isContractIgnored(_base)) {
            return false;
        }

        // if the contract severity found is ignored, then allow given call
        if (isSeverityIgnored(_base)) {
            return false;
        }

        // if none of the conditions above were met, then deny given call
        return true;
    }

    function _setDefaultIssuesRegistry(IssuesRegistry _defaultIssuesRegistry) internal {
        require(isContract(_defaultIssuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        defaultIssuesRegistry = _defaultIssuesRegistry;
        emit DefaultIssuesRegistrySet(address(_defaultIssuesRegistry));
    }

    /**
     * @dev This function allows different kill-switch implementations to provide a custom logic to tell whether a
     *      certain call should be denied or not. This is important to ensure recoverability. For example, custom
     *      implementations could override this function to provide a decision based on the msg.sender, timestamp,
     *      block information, among many other options.
     * @return Always true by default.
     */
    function _shouldEvaluateCall(address, address, address, bytes, uint256) internal returns (bool) {
        return true;
    }
}
