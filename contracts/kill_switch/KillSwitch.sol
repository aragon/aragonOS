pragma solidity 0.4.24;

import "./IKillSwitch.sol";
import "./IIssuesRegistry.sol";
import "../apps/AragonApp.sol";
import "../common/IsContract.sol";


contract KillSwitch is IKillSwitch, IsContract, AragonApp {
    /*
     * Hardcoded constants to save gas
     * bytes32 constant public SET_DEFAULT_ISSUES_REGISTRY_ROLE = keccak256("SET_DEFAULT_ISSUES_REGISTRY_ROLE");
     * bytes32 constant public SET_ALLOWED_INSTANCES_ROLE = keccak256("SET_ALLOWED_INSTANCES_ROLE");
     * bytes32 constant public SET_DENIED_BASE_IMPLS_ROLE = keccak256("SET_DENIED_BASE_IMPLS_ROLE");
     * bytes32 constant public SET_ISSUES_REGISTRY_ROLE = keccak256("SET_ISSUES_REGISTRY_ROLE");
     * bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = keccak256("SET_HIGHEST_ALLOWED_SEVERITY_ROLE");
     */

    bytes32 constant public SET_DEFAULT_ISSUES_REGISTRY_ROLE = 0xec32b556caaf18ff28362d6b89f3f678177fb74ae2c5c78bfbac6b1dedfa6b43;
    bytes32 constant public SET_ALLOWED_INSTANCES_ROLE = 0x98ff612ed29ae4d49b4e102b7554cfaba413a7f9c345ecd1c920f91df1eb22e8;
    bytes32 constant public SET_DENIED_BASE_IMPLS_ROLE = 0x6ec1c2a4f70ec94acd884927a40806e8282a03b3a489ac3c5551aee638767a33;
    bytes32 constant public SET_ISSUES_REGISTRY_ROLE = 0xc347b194ad4bc72077d417e05508bb224b4be509950d86cc7756e39a78fb725b;
    bytes32 constant public SET_HIGHEST_ALLOWED_SEVERITY_ROLE = 0xca159ccee5d02309b609308bfc70aecedaf2d2023cd19f9c223d8e9875a256ba;

    string constant private ERROR_ISSUES_REGISTRY_NOT_CONTRACT = "KS_ISSUES_REGISTRY_NOT_CONTRACT";

    struct IssuesSettings {
        IIssuesRegistry issuesRegistry;
        IIssuesRegistry.Severity highestAllowedSeverity;
    }

    IIssuesRegistry public defaultIssuesRegistry;
    mapping (address => bool) internal allowedInstances;
    mapping (address => bool) internal deniedBaseImplementations;
    mapping (bytes32 => IssuesSettings) internal appsIssuesSettings;

    event DefaultIssuesRegistrySet(address issuesRegistry);
    event AllowedInstanceSet(address indexed instance, bool allowed);
    event DeniedBaseImplementationSet(address indexed base, bool denied);
    event IssuesRegistrySet(bytes32 indexed appId, address issuesRegistry);
    event HighestAllowedSeveritySet(bytes32 indexed appId, IIssuesRegistry.Severity severity);

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

    function setAllowedInstance(address _instance, bool _allowed)
        external
        authP(SET_ALLOWED_INSTANCES_ROLE, arr(_instance))
    {
        allowedInstances[_instance] = _allowed;
        emit AllowedInstanceSet(_instance, _allowed);
    }

    function setDeniedBaseImplementation(address _base, bool _denied)
        external
        authP(SET_DENIED_BASE_IMPLS_ROLE, arr(_base))
    {
        deniedBaseImplementations[_base] = _denied;
        emit DeniedBaseImplementationSet(_base, _denied);
    }

    function setIssuesRegistry(bytes32 _appId, IIssuesRegistry _issuesRegistry)
        external
        authP(SET_ISSUES_REGISTRY_ROLE, arr(_appId))
    {
        require(isContract(_issuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        appsIssuesSettings[_appId].issuesRegistry = _issuesRegistry;
        emit IssuesRegistrySet(_appId, address(_issuesRegistry));
    }

    function setHighestAllowedSeverity(bytes32 _appId, IIssuesRegistry.Severity _severity)
        external
        authP(SET_HIGHEST_ALLOWED_SEVERITY_ROLE, arr(_appId))
    {
        appsIssuesSettings[_appId].highestAllowedSeverity = _severity;
        emit HighestAllowedSeveritySet(_appId, _severity);
    }

    /**
     * @dev Note that we are not checking if the appId, base address and instance address are valid and if they correspond
     *      to each other in order to reduce extra calls. However, since this is only a query method, wrong input
     *      can only result in invalid output. Internally, this method is used from the Kernel to stop calls if needed,
     *      and we have several tests to make sure its usage is working as expected.
     */
    function shouldDenyCallingApp(bytes32 _appId, address _base, address _instance) external returns (bool) {
        // if the instance is allowed, then allow given call
        if (isInstanceAllowed(_instance)) {
            return false;
        }

        // if the base implementation is denied, then deny given call
        if (isBaseImplementationDenied(_base)) {
            return true;
        }

        // if the app severity found is ignored, then allow given call
        if (isSeverityIgnored(_appId, _base)) {
            return false;
        }

        // if none of the conditions above were met, then deny given call
        return true;
    }

    function isInstanceAllowed(address _instance) public view returns (bool) {
        return allowedInstances[_instance];
    }

    function isBaseImplementationDenied(address _base) public view returns (bool) {
        return deniedBaseImplementations[_base];
    }

    function isSeverityIgnored(bytes32 _appId, address _base) public view returns (bool) {
        IIssuesRegistry.Severity severityFound = getIssuesRegistry(_appId).getSeverityFor(_base);
        IIssuesRegistry.Severity highestAllowedSeverity = getHighestAllowedSeverity(_appId);
        return highestAllowedSeverity >= severityFound;
    }

    function getIssuesRegistry(bytes32 _appId) public view returns (IIssuesRegistry) {
        IIssuesRegistry foundRegistry = appsIssuesSettings[_appId].issuesRegistry;
        return foundRegistry == IIssuesRegistry(0) ? defaultIssuesRegistry : foundRegistry;
    }

    function getHighestAllowedSeverity(bytes32 _appId) public view returns (IIssuesRegistry.Severity) {
        return appsIssuesSettings[_appId].highestAllowedSeverity;
    }

    function _setDefaultIssuesRegistry(IIssuesRegistry _defaultIssuesRegistry) internal {
        require(isContract(_defaultIssuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        defaultIssuesRegistry = _defaultIssuesRegistry;
        emit DefaultIssuesRegistrySet(address(_defaultIssuesRegistry));
    }
}
