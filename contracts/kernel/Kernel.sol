pragma solidity 0.4.15;

import "./KernelStorage.sol";
import "../common/Initializable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract Kernel is KernelStorage, Initializable {
    using SafeMath for uint256;

    struct Permission {
        address parent;
        bool allowed;
    }

    // whether a certain entity has a permission
    mapping (address => mapping (address => mapping (bytes4 => Permission))) permissions;
    // how many entities have been given a certain permission
    mapping (address => mapping (bytes4 => uint256)) public permissionInstances;
    // appId -> implementation
    mapping (bytes32 => address) appCode;

    event SetPermission(address indexed entity, address indexed app, bytes4 indexed action, address parent, bool allowed);
    event UpgradeKernel(address indexed newKernel);
    event SetAppCode(bytes32 indexed appId, address indexed newAppCode);

    function initialize(address _permissionsCreator) onlyInit {
        initialized();
        bytes4 createPermissionAction = bytes4(sha3("createPermission(address,address,bytes4,address)"));
        _createPermission(_permissionsCreator, address(this), createPermissionAction, _permissionsCreator);
    }

    function createPermission(address _entity, address _app, bytes4 _action, address _parent) auth external {
        _createPermission(_entity, _app, _action, _parent);
    }

    function grantPermission(address _entity, address _app, bytes4 _action, address _parent) external {
        // Implicitely check parent has permission and its parent of it (if it didn't have permission, it wouldn't have a parent)
        require(permissions[msg.sender][_app][_action].parent == msg.sender);
        // Permission can only can be set if entity doesn't already have it
        require(permissions[_entity][_app][_action].allowed == false);

        _setPermission(_entity, _app, _action, _parent, true);
    }

    function revokePermission(address _entity, address _app, bytes4 _action) external {
        require(permissions[_entity][_app][_action].parent == msg.sender);

        _setPermission(_entity, _app, _action, 0, false);
    }

    function setAppCode(bytes32 _appId, address _code) auth external {
        appCode[_appId] = _code;
        SetAppCode(_appId, _code);
    }

    function upgradeKernel(address _newKernel) auth external {
        kernelImpl = _newKernel;
        UpgradeKernel(_newKernel);
    }

    function canPerform(address _entity, address _app, bytes4 _action) constant returns (bool) {
        return permissions[_entity][_app][_action].allowed;
    }

    function getAppCode(bytes32 _appId) constant returns (address) {
        return appCode[_appId];
    }

    function _createPermission(address _entity, address _app, bytes4 _action, address _parent) internal {
        require(permissionInstances[_app][_action] == 0);
        _setPermission(_entity, _app, _action, _parent, true);
    }

    function _setPermission(address _entity, address _app, bytes4 _action, address _parent, bool _allowed) internal {
        permissions[_entity][_app][_action] = Permission(_parent, _allowed);

        if (_allowed) {
            permissionInstances[_app][_action] = permissionInstances[_app][_action].add(1);
        } else {
            permissionInstances[_app][_action] = permissionInstances[_app][_action].sub(1);
        }

        SetPermission(_entity, _app, _action, _parent, _allowed);
    }

    modifier auth {
        require(canPerform(msg.sender, address(this), msg.sig));
        _;
    }
}
