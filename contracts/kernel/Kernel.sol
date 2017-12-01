pragma solidity 0.4.15;

import "./IKernel.sol";
import "./KernelStorage.sol";
import "../common/Initializable.sol";
import "../zeppelin/math/SafeMath.sol";

contract Kernel is IKernel, KernelStorage, Initializable {
    bytes32 constant public CREATE_PERMISSIONS_ROLE = bytes32(1);
    bytes32 constant public UPGRADE_APPS_ROLE = bytes32(2);
    bytes32 constant public UPGRADE_KERNEL_ROLE = bytes32(3);

    // whether a certain entity has a permission
    mapping (address => mapping (address => mapping (bytes32 => bool))) permissions;
    // who is the owner of a permission
    mapping (address => mapping (bytes32 => address)) permissionOwner;
    // appId -> implementation
    mapping (bytes32 => address) appCode;

    modifier onlyPermissionOwner(address app, bytes32 role) {
        require(msg.sender == getPermissionOwner(app, role));
        _;
    }

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(address _permissionsCreator) onlyInit public {
        initialized();

        _createPermission(
            _permissionsCreator,
            address(this),
            CREATE_PERMISSIONS_ROLE,
            _permissionsCreator
        );
    }

    /**
    * @dev Creates a permission that wasn't previously set. Access is limited by the ACL.
    *      if a created permission is removed it is possible to reset it with createPermission.
    * @notice Create a new permission granting `_entity` the ability to perform actions of role `_role` on `_app` (setting `_owner` as parent)
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    * @param _owner Address of the entity that will be able to grant and revoke the permission further.
    */
    function createPermission(
        address _entity,
        address _app,
        bytes32 _role,
        address _owner
    )
        auth(CREATE_PERMISSIONS_ROLE)
        external
    {
        _createPermission(
            _entity,
            _app,
            _role,
            _owner
        );
    }

    /**
    * @dev Grants a permission if allowed. This requires `msg.sender` to be the permission owner
    * @notice Grants `_entity` the ability to perform actions of role `_role` on `_app`
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function grantPermission(address _entity, address _app, bytes32 _role)
        onlyPermissionOwner(_app, _role)
        external
    {
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
        onlyPermissionOwner(_app, _role)
        external
    {
        _setPermission(
            _entity,
            _app,
            _role,
            false
        );
    }

    /**
    * @notice Sets `_newOwner` as the owner of the permission `_role` in `_app`
    * @param _newOwner Address for the new owner
    * @param _app Address of the app in which the permission ownership is being transferred
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function setPermissionOwner(address _newOwner, address _app, bytes32 _role)
        onlyPermissionOwner(_app, _role)
        external
    {
        _setPermissionOwner(_newOwner, _app, _role);
    }

    /**
    * @dev Changes appCode reference for `_appId`. This role is required before an app with a certain appId working properly
    * @notice Upgrade app code of `_appId` to new implementation at address `_code` (CRITICAL!)
    * @param _appId Namehash of the app name
    * @param _code Implementation for app
    */
    function setAppCode(bytes32 _appId, address _code) auth(UPGRADE_APPS_ROLE) external {
        appCode[_appId] = _code;
        SetAppCode(_appId, _code);
    }

    /**
    * @dev Changes kernel implementation reference to a new address
    * @notice Upgrade kernel to new implementation at address `_newKernel` (CRITICAL!)
    * @param _newKernel Address for new kernel code
    */
    function upgradeKernel(address _newKernel) auth(UPGRADE_KERNEL_ROLE) external {
        kernelImpl = _newKernel;
        UpgradeKernel(_newKernel);
    }

    /**
    * @dev Get permission status
    * @param _entity Entity address checked
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return allowed boolean indicating whether entity has permissions over role
    * @return owner address that can revoke or grant the permission
    */
    function getPermission(address _entity, address _app, bytes32 _role) constant public returns (bool) {
        return permissions[_entity][_app][_role];
    }

    /**
    * @dev Get owner address for permission
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return address of the owner for the permission
    */
    function getPermissionOwner(address _app, bytes32 _role) constant public returns (address) {
        return permissionOwner[_app][_role];
    }

    /**
    * @dev Function called by apps to check ACL on kernel
    * @param _entity Sender of the original call
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return boolean indicating whether the ACL allows the role or not
    */
    function canPerform(address _entity, address _app, bytes32 _role) constant public returns (bool) {
        return getPermission(_entity, _app, _role);
    }

    /**
    * @dev Function called by AppProxies to get app code reference
    * @param _appId Identifier for app
    * @return address for app code
    */
    function getAppCode(bytes32 _appId) constant public returns (address) {
        return appCode[_appId];
    }

    /**
    * @dev Internal createPermission for access inside the kernel (on instantiation)
    */
    function _createPermission(
        address _entity,
        address _app,
        bytes32 _role,
        address _owner
    )
        internal
    {
        // only allow permission creation when it has no owner (hasn't been created before)
        require(permissionOwner[_app][_role] == 0);

        _setPermission(
            _entity,
            _app,
            _role,
            true
        );
        _setPermissionOwner(_owner, _app, _role);
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
    * @dev Internal function that sets ownership
    */
    function _setPermissionOwner(address _newOwner, address _app, bytes32 _role) internal {
        require(_newOwner > 0);

        permissionOwner[_app][_role] = _newOwner;
        ChangePermissionOwner(_app, _role, _newOwner);
    }

    modifier auth(bytes32 _role) {
        require(canPerform(msg.sender, address(this), _role));
        _;
    }
}
