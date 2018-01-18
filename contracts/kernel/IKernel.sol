pragma solidity ^0.4.18;


interface IKernel {
    event SetPermission(address indexed entity, address indexed app, bytes32 indexed role, bool allowed);
    event ChangePermissionManager(address indexed app, bytes32 indexed role, address indexed manager);
    event UpgradeKernel(address indexed newKernel);
    event SetAppCode(bytes32 indexed appId, address indexed newAppCode);

    function createPermission(address _entity, address _app, bytes32 _role, address _manager) external;
    function grantPermission(address _entity, address _app,  bytes32 _role) external;
    function revokePermission(address _entity, address _app, bytes32 _role) external;
    function setPermissionManager(address _newManager, address _app, bytes32 _role) external;

    function setAppCode(bytes32 _appId, address _code) external;
    function upgradeKernel(address _newKernel) external;

    function getPermissionManager(address _app, bytes32 _role) view public returns (address);

    function hasPermission(address _entity, address _app, bytes32 _role) view public returns (bool);
    function getAppCode(bytes32 _appId) view public returns (address);
}
