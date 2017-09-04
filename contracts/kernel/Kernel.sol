pragma solidity 0.4.15;

import "./KernelProxy.sol";
import "../helpers/Initializable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract Kernel is KernelProxy, Initializable {
    using SafeMath for uint256;

    struct Permission {
        address parent;
        bool allowed;
    }

    // whether a certain entity has a permission
    mapping (address => mapping (address => mapping (bytes4 => Permission))) permissions;
    // how many entities have been given a certain permission
    mapping (address => mapping (bytes4 => uint256)) permissionInstances;

    event SetPermission(address indexed entity, address indexed app, bytes4 indexed action, address parent, bool allowed);

    function initialize(address _permissionsCreator) onlyInit {
        initialized();
        bytes4 installPermissionAction = bytes4(sha3("installPermission(address,address,bytes4,address)"));
        _installPermission(_permissionsCreator, address(this), installPermissionAction, _permissionsCreator);
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

    function installPermission(address _entity, address _app, bytes4 _action, address _parent) auth external {
        _installPermission(_entity, _app, _action, _parent);
    }

    function canPerform(address _entity, address _app, bytes4 _action) constant returns (bool) {
        return permissions[_entity][_app][_action].allowed;
    }

    function _installPermission(address _entity, address _app, bytes4 _action, address _parent) internal {
        require(permissionInstances[_app][_action] == 0);
        _setPermission(_entity, _app, _action, _parent, true);
    }

    function _setPermission(address _entity, address _app, bytes4 _action, address _parent, bool _allowed) internal {
        permissions[_entity][_app][_action] = Permission(_parent, _allowed);

        if (_allowed) {
            permissionInstances[_app][_action].add(1);
        } else {
            permissionInstances[_app][_action].sub(1);
        }

        SetPermission(_entity, _app, _action, _parent, _allowed);
    }

    modifier auth {
        require(canPerform(msg.sender, address(this), msg.sig));
        _;
    }
}
