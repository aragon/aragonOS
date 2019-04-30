pragma solidity 0.4.24;

import "./IssuesRegistry.sol";


contract KillSwitch is AragonApp {
    bytes32 constant public SET_ISSUES_REGISTRY_ROLE = keccak256("SET_ISSUES_REGISTRY_ROLE");
    bytes32 constant public SET_CONTRACT_ACTION_ROLE = keccak256("SET_CONTRACT_ACTION_ROLE");
    bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = keccak256("SET_HIGHEST_ALLOWED_SEVERITY_ROLE");

    enum ContractAction { Check, Ignore, Deny }

    IssuesRegistry public issuesRegistry;
    mapping (address => ContractAction) internal contractActions;
    mapping (address => IssuesRegistry.Severity) internal highestAllowedSeverityByContract;

    event IssuesRegistrySet(address issuesRegistry, address sender);
    event ContractActionSet(address contractAddress, ContractAction action);
    event HighestAllowedSeveritySet(address indexed _contract, IssuesRegistry.Severity severity);

    function initialize(IssuesRegistry _issuesRegistry) external onlyInit {
        initialized();
        _setIssuesRegistry(_issuesRegistry);
    }

    function setContractAction(address _contract, ContractAction _action)
        external
        authP(SET_CONTRACT_ACTION_ROLE, arr(_contract, msg.sender))
    {
        contractActions[_contract] = _action;
        emit ContractActionSet(_contract, _action);
    }

    function setHighestAllowedSeverity(address _contract, IssuesRegistry.Severity _severity)
        external
        authP(SET_HIGHEST_ALLOWED_SEVERITY_ROLE, arr(_contract, msg.sender))
    {
        highestAllowedSeverityByContract[_contract] = _severity;
        emit HighestAllowedSeveritySet(_contract, _severity);
    }

    function setIssuesRegistry(IssuesRegistry _issuesRegistry)
        external
        authP(SET_ISSUES_REGISTRY_ROLE, arr(msg.sender))
    {
        _setIssuesRegistry(_issuesRegistry);
    }

    function getContractAction(address _contract) public view returns (ContractAction) {
        return contractActions[_contract];
    }

    function getHighestAllowedSeverity(address _contract) public view returns (IssuesRegistry.Severity) {
        return highestAllowedSeverityByContract[_contract];
    }

    function isContractIgnored(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Ignore;
    }

    function isContractDenied(address _contract) public view returns (bool) {
        return getContractAction(_contract) == ContractAction.Deny;
    }

    function isSeverityIgnored(address _contract) public view returns (bool) {
        IssuesRegistry.Severity severityFound = issuesRegistry.getSeverityFor(_contract);
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

        // if the issues registry has not been set, then allow given call
        if (issuesRegistry == address(0)) {
            return false;
        }

        // if the contract severity found is ignored, then allow given call
        if (isSeverityIgnored(_base)) {
            return false;
        }

        // if none of the conditions above were met, then deny given call
        return true;
    }

    function _setIssuesRegistry(IssuesRegistry _issuesRegistry) internal {
        issuesRegistry = _issuesRegistry;
        emit IssuesRegistrySet(_issuesRegistry, msg.sender);
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
