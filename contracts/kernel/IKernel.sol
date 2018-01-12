pragma solidity ^0.4.18;

contract ACLEvents {
    event SetPermission(address indexed entity, address indexed app, bytes32 indexed role, bool allowed);
    event ChangePermissionManager(address indexed app, bytes32 indexed role, address indexed manager);
}

contract IKernel is ACLEvents {
    event UpgradeKernel(address indexed newKernel);
    event SetCode(bytes32 indexed appId, address indexed newCode);

    function createPermission(address _entity, address _app, bytes32 _role, address _manager) external;
    function grantPermission(address _entity, address _app,  bytes32 _role) external;
    function revokePermission(address _entity, address _app, bytes32 _role) external;
    function setPermissionManager(address _newManager, address _app, bytes32 _role) external;

    function setCode(bytes32 _appId, address _code) external;
    function upgradeKernel(address _newKernel) external;

    function getPermissionManager(address _app, bytes32 _role) view public returns (address);

    function hasPermission(address _entity, address _app, bytes32 _role) view public returns (bool);
    function getCode(bytes32 _appId) view public returns (address);
}
