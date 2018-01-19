pragma solidity 0.4.18;

import "../kernel/IACL.sol";
import "../common/Initializable.sol";
import "../apps/AragonApp.sol";


contract ACL is AragonApp, IACL {
    bytes32 constant public CREATE_PERMISSIONS_ROLE = bytes32(1);

    // whether a certain entity has a permission
    mapping (address => mapping (address => mapping (bytes32 => bool))) permissions;
    // who is the manager of a permission
    mapping (address => mapping (bytes32 => address)) permissionManager;

    modifier onlyPermissionManager(address app, bytes32 role) {
        require(msg.sender == getPermissionManager(app, role));
        _;
    }

    event SetPermission(address indexed entity, address indexed app, bytes32 indexed role, bool allowed);
    event ChangePermissionManager(address indexed app, bytes32 indexed role, address indexed manager);

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(address _permissionsCreator) onlyInit public {
        initialized();

        require(msg.sender == address(kernel));

        _createPermission(
            _permissionsCreator,
            address(this),
            CREATE_PERMISSIONS_ROLE,
            _permissionsCreator
        );
    }

    /**
    * @dev Creates a permission that wasn't previously set. Access is limited by the ACL.
    *      If a created permission is removed it is possible to reset it with createPermission.
    * @notice Create a new permission granting `_entity` the ability to perform actions of role `_role` on `_app` (setting `_manager` as parent)
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    * @param _manager Address of the entity that will be able to grant and revoke the permission further.
    */
    function createPermission(
        address _entity,
        address _app,
        bytes32 _role,
        address _manager
    )
        external
    {
        require(hasPermission(msg.sender, address(this), _role));
        _createPermission(
            _entity,
            _app,
            _role,
            _manager
        );
    }

    /**
    * @dev Grants a permission if allowed. This requires `msg.sender` to be the permission manager
    * @notice Grants `_entity` the ability to perform actions of role `_role` on `_app`
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function grantPermission(address _entity, address _app, bytes32 _role)
        onlyPermissionManager(_app, _role)
        external
    {
        require(!hasPermission(_entity, _app, _role));
        _setPermission(
            _entity,
            _app,
            _role,
            true
        );
    }

    /**
    * @dev Revokes permission if allowed. This requires `msg.sender` to be the parent of the permission
    * @notice Revokes `_entity` the ability to perform actions of role `_role` on `_app`
    * @param _entity Address of the whitelisted entity that will be revoked access
    * @param _app Address of the app in which the role is revoked
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function revokePermission(address _entity, address _app, bytes32 _role)
        onlyPermissionManager(_app, _role)
        external
    {
        require(hasPermission(_entity, _app, _role));
        _setPermission(
            _entity,
            _app,
            _role,
            false
        );
    }

    /**
    * @notice Sets `_newManager` as the manager of the permission `_role` in `_app`
    * @param _newManager Address for the new manager
    * @param _app Address of the app in which the permission management is being transferred
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function setPermissionManager(address _newManager, address _app, bytes32 _role)
        onlyPermissionManager(_app, _role)
        external
    {
        _setPermissionManager(_newManager, _app, _role);
    }

    /**
    * @dev Get manager address for permission
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return address of the manager for the permission
    */
    function getPermissionManager(address _app, bytes32 _role) view public returns (address) {
        return permissionManager[_app][_role];
    }

    /**
    * @dev Function called by apps to check ACL on kernel or to check permission statu
    * @param _entity Sender of the original call
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return boolean indicating whether the ACL allows the role or not
    */
    function hasPermission(address _entity, address _app, bytes32 _role) view public returns (bool) {
        return permissions[_entity][_app][_role];
    }

    function hasPermission(address who, address where, bytes32 what, bytes how) view public returns (bool) {
        return hasPermission(who, where, what);
    }

    /**
    * @dev Internal createPermission for access inside the kernel (on instantiation)
    */
    function _createPermission(
        address _entity,
        address _app,
        bytes32 _role,
        address _manager
    )
        internal
    {
        // only allow permission creation when it has no manager (hasn't been created before)
        require(permissionManager[_app][_role] == address(0));

        _setPermission(
            _entity,
            _app,
            _role,
            true
        );
        _setPermissionManager(_manager, _app, _role);
    }

    /**
    * @dev Internal function called to actually save the permission
    */
    function _setPermission(
        address _entity,
        address _app,
        bytes32 _role,
        bool _allowed
    )
        internal
    {
        permissions[_entity][_app][_role] = _allowed;

        SetPermission(
            _entity,
            _app,
            _role,
            _allowed
        );
    }

    /**
    * @dev Internal function that sets management
    */
    function _setPermissionManager(address _newManager, address _app, bytes32 _role) internal {
        // require(_newManager != address(0));

        permissionManager[_app][_role] = _newManager;
        ChangePermissionManager(_app, _role, _newManager);
    }
}
