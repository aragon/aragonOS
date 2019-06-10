pragma solidity 0.4.24;

import "./IKillSwitch.sol";
import "./IIssuesRegistry.sol";
import "../apps/AragonApp.sol";
import "../common/IsContract.sol";


contract KillSwitch is IKillSwitch, IsContract, AragonApp {
    /*
     * Hardcoded constants to save gas
     * bytes32 constant public CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE = keccak256("CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE");
     * bytes32 constant public CHANGE_WHITELISTED_INSTANCES_ROLE = keccak256("CHANGE_WHITELISTED_INSTANCES_ROLE");
     * bytes32 constant public CHANGE_BLACKLISTED_BASE_IMPLS_ROLE = keccak256("CHANGE_BLACKLISTED_BASE_IMPLS_ROLE");
     * bytes32 constant public CHANGE_ISSUES_REGISTRY_ROLE = keccak256("CHANGE_ISSUES_REGISTRY_ROLE");
     * bytes32 constant public CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE = keccak256("CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE");
     */
    bytes32 constant public CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE = 0xdc8509ec9a919d33309806f4c91c281bcd27100bf2f895bcf78c5b42a0c39517;
    bytes32 constant public CHANGE_WHITELISTED_INSTANCES_ROLE = 0x015a45e5f33fcae59ca7bd74eb36669dbf842f279d59011ea683d2867d05464a;
    bytes32 constant public CHANGE_BLACKLISTED_BASE_IMPLS_ROLE = 0x05c71f33783f36a1b1a40c12d7308ff84c475600d0a4ff736122d42d72eafd4c;
    bytes32 constant public CHANGE_ISSUES_REGISTRY_ROLE = 0x05b8a6bf0cdb51438256b73559daacd20b321e9c934d472dddb8f6cf12e6e048;
    bytes32 constant public CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE = 0x1aec2a88cc5515dccebf91f7653b986b872c1cea4b784dc2eb5d285a6ccb2998;

    string constant private ERROR_ISSUES_REGISTRY_NOT_CONTRACT = "KS_ISSUES_REGISTRY_NOT_CONTRACT";

    struct IssuesSettings {
        IIssuesRegistry issuesRegistry;
        IIssuesRegistry.Severity highestAllowedSeverity;
    }

    IIssuesRegistry public defaultIssuesRegistry;
    mapping (address => bool) internal whitelistedInstances;
    mapping (address => bool) internal blacklistedBaseImplementations;
    mapping (bytes32 => IssuesSettings) internal appsIssuesSettings;

    event ChangeDefaultIssuesRegistry(address indexed issuesRegistry);
    event ChangeWhitelistedInstance(address indexed instance, bool whitelisted);
    event ChangeBlacklistedBaseImplementation(address indexed base, bool blacklisted);
    event ChangeIssuesRegistry(bytes32 indexed appId, address issuesRegistry);
    event ChangeHighestAllowedSeverity(bytes32 indexed appId, IIssuesRegistry.Severity severity);

    function initialize(IIssuesRegistry _defaultIssuesRegistry) external onlyInit {
        initialized();
        _setDefaultIssuesRegistry(_defaultIssuesRegistry);
    }

    function setDefaultIssuesRegistry(IIssuesRegistry _defaultIssuesRegistry)
        external
        auth(CHANGE_DEFAULT_ISSUES_REGISTRY_ROLE)
    {
        _setDefaultIssuesRegistry(_defaultIssuesRegistry);
    }

    function setWhitelistedInstance(address _instance, bool _allowed)
        external
        authP(CHANGE_WHITELISTED_INSTANCES_ROLE, arr(_instance, whitelistedInstances[_instance], _allowed))
    {
        whitelistedInstances[_instance] = _allowed;
        emit ChangeWhitelistedInstance(_instance, _allowed);
    }

    function setBlacklistedBaseImplementation(address _base, bool _denied)
        external
        authP(CHANGE_BLACKLISTED_BASE_IMPLS_ROLE, arr(_base, blacklistedBaseImplementations[_base], _denied))
    {
        blacklistedBaseImplementations[_base] = _denied;
        emit ChangeBlacklistedBaseImplementation(_base, _denied);
    }

    function setIssuesRegistry(bytes32 _appId, IIssuesRegistry _issuesRegistry)
        external
        authP(CHANGE_ISSUES_REGISTRY_ROLE, arr(_appId, address(appsIssuesSettings[_appId].issuesRegistry), address(_issuesRegistry)))
    {
        require(isContract(_issuesRegistry), ERROR_ISSUES_REGISTRY_NOT_CONTRACT);
        appsIssuesSettings[_appId].issuesRegistry = _issuesRegistry;
        emit ChangeIssuesRegistry(_appId, address(_issuesRegistry));
    }

    function setHighestAllowedSeverity(bytes32 _appId, IIssuesRegistry.Severity _severity)
        external
        authP(CHANGE_HIGHEST_ALLOWED_SEVERITY_ROLE, arr(_appId, uint256(appsIssuesSettings[_appId].highestAllowedSeverity), uint256(_severity)))
    {
        appsIssuesSettings[_appId].highestAllowedSeverity = _severity;
        emit ChangeHighestAllowedSeverity(_appId, _severity);
    }

    /**
     * @dev Note that we are not checking if the appId, base address and instance address are valid and if they correspond
     *      to each other in order to reduce extra calls. However, since this is only a query method, wrong input
     *      can only result in invalid output. Internally, this method is used from the Kernel to stop calls if needed,
     *      and we have several tests to make sure its usage is working as expected.
     */
    function shouldDenyCallingApp(bytes32 _appId, address _base, address _instance) external view returns (bool) {
        // If the instance is the kill switch itself, then allow given call
        if (_instance == address(this)) {
            return false;
        }

        // If the instance is whitelisted, then allow given call
        if (isInstanceWhitelisted(_instance)) {
            return false;
        }

        // Check if the base implementation is allowed
        return shouldDenyCallingBaseApp(_appId, _base);
    }

    function shouldDenyCallingBaseApp(bytes32 _appId, address _base) public view returns (bool) {
        // If the base implementation is blacklisted, then deny given call
        if (isBaseImplementationBlacklisted(_base)) {
            return true;
        }

        // Check if there is a severity issue reported in the corresponding issue registry. If there is actually a
        // severity issue, check if it has exceeded the highest allowed severity level or not.
        return hasExceededAllowedSeverity(_appId, _base);
    }

    function isInstanceWhitelisted(address _instance) public view returns (bool) {
        return whitelistedInstances[_instance];
    }

    function isBaseImplementationBlacklisted(address _base) public view returns (bool) {
        return blacklistedBaseImplementations[_base];
    }

    function hasExceededAllowedSeverity(bytes32 _appId, address _base) public view returns (bool) {
        IIssuesRegistry.Severity severityFound = getIssuesRegistry(_appId).getSeverityFor(_base);
        IIssuesRegistry.Severity highestAllowedSeverity = getHighestAllowedSeverity(_appId);
        return highestAllowedSeverity < severityFound;
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
        emit ChangeDefaultIssuesRegistry(address(_defaultIssuesRegistry));
    }
}
