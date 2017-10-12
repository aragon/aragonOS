pragma solidity 0.4.15;

import "./KernelStorage.sol";
import "../common/Initializable.sol";
import "../zeppelin/math/SafeMath.sol";

contract Kernel is KernelStorage, Initializable {
    using SafeMath for uint256;

    struct Permission {
        address parent;
        bool allowed;
    }

    bytes32 constant public CREATE_PERMISSIONS_ROLE = bytes32(1);
    bytes32 constant public UPGRADE_APPS_ROLE = bytes32(2);
    bytes32 constant public UPGRADE_KERNEL_ROLE = bytes32(3);

    // whether a certain entity has a permission
    mapping (address => mapping (address => mapping (bytes32 => Permission))) permissions;
    // how many entities have been given a certain permission
    mapping (address => mapping (bytes32 => uint256)) public permissionInstances;
    // appId -> implementation
    mapping (bytes32 => address) appCode;

    event SetPermission(address indexed entity, address indexed app, bytes32 indexed role, address parent, bool allowed);
    event UpgradeKernel(address indexed newKernel);
    event SetAppCode(bytes32 indexed appId, address indexed newAppCode);

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(address _permissionsCreator) onlyInit {
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
    * @notice Create a new permission granting `_entity` the ability to perform actions of role `_role` on `_app` (setting `_parent` as parent)
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    * @param _parent Address of the entity that will be able to revoke the permission. If set to `_entity`, then it will be able to grant it too
    */
    function createPermission(
        address _entity, 
        address _app, 
        bytes32 _role, 
        address _parent
    ) auth(CREATE_PERMISSIONS_ROLE) external 
    {
        _createPermission(
            _entity, 
            _app, 
            _role, 
            _parent
        );
    }

    /**
    * @dev Grants a permission if allowed. This requires `msg.sender` to have the permission and be its own parent
    * @notice Grants `_entity` the ability to perform actions of role `_role` on `_app` (setting `_parent` as parent)
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    * @param _parent Address of the entity that will be able to revoke the permission. If set to `_entity`, then it will be able to grant it too
    */
    function grantPermission(
        address _entity, 
        address _app, 
        bytes32 _role, 
        address _parent
    ) external
    {
        // Implicitely check parent has permission and its parent of it (if it didn't have permission, it wouldn't have a parent)
        require(permissions[msg.sender][_app][_role].parent == msg.sender);
        // Permission can only can be set if entity doesn't already have it
        require(permissions[_entity][_app][_role].allowed == false);

        _setPermission(
            _entity, 
            _app, 
            _role, 
            _parent, 
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
    function revokePermission(address _entity, address _app, bytes32 _role) external {
        require(permissions[_entity][_app][_role].parent == msg.sender);

        _setPermission(
            _entity, 
            _app, 
            _role, 
            0, 
            false
        );
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
    * @dev Function called by apps to check ACL on kernel
    * @param _entity Sender of the original call
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return boolean indicating whether the ACL allows the role or not
    */
    function canPerform(address _entity, address _app, bytes32 _role) constant returns (bool) {
        return permissions[_entity][_app][_role].allowed;
    }

    /**
    * @dev Function called by AppProxies to get app code reference
    * @param _appId Identifier for app
    * @return address for app code
    */
    function getAppCode(bytes32 _appId) constant returns (address) {
        return appCode[_appId];
    }

    /**
    * @dev Internal createPermission for access inside the kernel (on instantiation)
    */
    function _createPermission(
        address _entity, 
        address _app, 
        bytes32 _role, 
        address _parent
    ) internal 
    {
        // only allow permission creation when there is no instance of the permission
        require(permissionInstances[_app][_role] == 0);
        _setPermission(
            _entity, 
            _app, 
            _role, 
            _parent, 
            true
        );
    }

    /**
    * @dev Internal function called to actually save the permission
    */
    function _setPermission(
        address _entity, 
        address _app, 
        bytes32 _role, 
        address _parent, 
        bool _allowed
    ) internal 
    {
        permissions[_entity][_app][_role] = Permission(_parent, _allowed);

        if (_allowed) {
            permissionInstances[_app][_role] = permissionInstances[_app][_role].add(1);
        } else {
            permissionInstances[_app][_role] = permissionInstances[_app][_role].sub(1);
        }
        
        SetPermission(
            _entity, 
            _app, 
            _role, 
            _parent, 
            _allowed
        );
    }

    modifier auth(bytes32 _role) {
        require(canPerform(msg.sender, address(this), _role));
        _;
    }
}
