pragma solidity 0.4.24;

import "./IssuesRegistry.sol";


contract KillSwitch {
    IssuesRegistry public issuesRegistry;

    event IssuesRegistrySet(address issuesRegistry, address sender);

    function isContractIgnored(address _contract) public view returns (bool);

    function isSeverityIgnored(address _contract, IssuesRegistry.Severity _severity) public view returns (bool);

    function shouldDenyCallingContract(address _base, address _instance, address _sender, bytes _data, uint256 _value) public returns (bool) {
        // if the call should not be evaluated, then allow given call
        if (!_shouldEvaluateCall(_base, _instance, _sender, _data, _value)) return false;

        // if the contract issues are ignored, then allow given call
        if (isContractIgnored(_base)) return false;

        // if the issues registry has not been set, then allow given call
        if (issuesRegistry == address(0)) return false;

        // if the contract severity found is ignored, then allow given call
        IssuesRegistry.Severity _severityFound = issuesRegistry.getSeverityFor(_base);
        if (isSeverityIgnored(_base, _severityFound)) return false;

        // if none of the conditions above were met, then deny given call
        return true;
    }

    /**
     * @dev This function allows different kill-switch implementations to provide a custom logic to tell whether a
     *      certain call should be denied or not. This is important to ensure recoverability. For example, custom
     *      implementations could override this function to provide a decision based on the msg.sender, timestamp,
     *      block information, among many other options.
     * @return Always true by default.
     */
    function _shouldEvaluateCall(address /*_base*/, address /*_instance*/, address /*_sender*/, bytes /*_data*/, uint256 /*_value*/) internal returns (bool) {
        return true;
    }

    function _setIssuesRegistry(IssuesRegistry _issuesRegistry) internal {
        issuesRegistry = _issuesRegistry;
        emit IssuesRegistrySet(_issuesRegistry, msg.sender);
    }
}
