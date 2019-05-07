pragma solidity 0.4.24;

import "../kernel/IKernel.sol";
import "../kernel/Kernel.sol";
import "../kernel/KernelProxy.sol";
import "../kill_switch/KillSwitch.sol";
import "../kill_switch/IssuesRegistry.sol";

import "../acl/IACL.sol";
import "../acl/ACL.sol";

import "./EVMScriptRegistryFactory.sol";


contract DAOFactory {
    IKernel public baseKernel;
    IACL public baseACL;
    KillSwitch public baseKillSwitch;
    EVMScriptRegistryFactory public scriptsRegistryFactory;

    event DeployDAO(address dao);
    event DeployEVMScriptRegistry(address registry);

    /**
    * @notice Create a new DAOFactory, creating DAOs with Kernels proxied to `_baseKernel`, ACLs proxied to `_baseACL`, and new EVMScriptRegistries created from `_scriptsRegistryFactory`.
    * @param _baseKernel Base Kernel
    * @param _baseACL Base ACL
    * @param _scriptsRegistryFactory EVMScriptRegistry factory
    */
    constructor(
        IKernel _baseKernel,
        IACL _baseACL,
        KillSwitch _baseKillSwitch,
        EVMScriptRegistryFactory _scriptsRegistryFactory
    )
        public
    {
        // No need to init as it cannot be killed by devops199
        if (address(_scriptsRegistryFactory) != address(0)) {
            scriptsRegistryFactory = _scriptsRegistryFactory;
        }

        baseKernel = _baseKernel;
        baseACL = _baseACL;
        baseKillSwitch = _baseKillSwitch;
    }

    /**
    * @notice Create a new DAO with `_root` set as the initial admin
    * @param _root Address that will be granted control to setup DAO permissions
    * @return Newly created DAO
    */
    function newDAO(address _root) public returns (Kernel) {
        if (address(scriptsRegistryFactory) == address(0)) {
            return _createDAO(_root);
        }

        Kernel dao = _createDAO(address(this));
        _setupNewDaoPermissions(dao, _root);
        return dao;
    }

    /**
    * @notice Create a new DAO with `_root` set as the initial admin and `_issuesRegistry` as the source of truth for kill-switch purpose
    * @param _root Address that will be granted control to setup DAO permissions
    * @param _issuesRegistry Address of the registry of issues that will be used in case of critical situations by the kill switch
    * @return Newly created DAO
    */
    function newDAOWithKillSwitch(address _root, IssuesRegistry _issuesRegistry) public returns (Kernel) {
        Kernel dao = _createDAO(address(this));
        _createKillSwitch(dao, _issuesRegistry);

        if (address(scriptsRegistryFactory) == address(0)) {
            _transferCreatePermissionsRole(dao, _root);
        } else {
            _setupNewDaoPermissions(dao, _root);
        }

        return dao;
    }

    function _createDAO(address _permissionsCreator) internal returns (Kernel) {
        Kernel dao = Kernel(new KernelProxy(baseKernel));
        dao.initialize(baseACL, _permissionsCreator);
        emit DeployDAO(address(dao));
        return dao;
    }

    function _createKillSwitch(Kernel _dao, IssuesRegistry _issuesRegistry) internal {
        // create app manager role for this
        ACL acl = ACL(_dao.acl());
        bytes32 appManagerRole = _dao.APP_MANAGER_ROLE();
        acl.createPermission(address(this), _dao, appManagerRole, address(this));

        // create kill switch instance and set it as default
        bytes32 killSwitchAppID = _dao.DEFAULT_KILL_SWITCH_APP_ID();
        bytes memory _initializeData = abi.encodeWithSelector(baseKillSwitch.initialize.selector, _issuesRegistry);
        _dao.newAppInstance(killSwitchAppID, baseKillSwitch, _initializeData, true);

        // remove app manager role permissions from this
        _removeAppManagerRole(_dao, address(this));
    }

    function _setupNewDaoPermissions(Kernel _dao, address _root) internal {
        ACL acl = ACL(_dao.acl());

        // grant create permissions role to the scripts registry factory
        bytes32 createPermissionsRole = acl.CREATE_PERMISSIONS_ROLE();
        acl.grantPermission(scriptsRegistryFactory, acl, createPermissionsRole);

        // create app manager role to scripts registry factory and call
        _createAppManagerRole(_dao, scriptsRegistryFactory);
        EVMScriptRegistry scriptsRegistry = scriptsRegistryFactory.newEVMScriptRegistry(_dao);
        emit DeployEVMScriptRegistry(address(scriptsRegistry));

        // remove app manager role permissions from the script registry factory
        _removeAppManagerRole(_dao, scriptsRegistryFactory);

        // revoke create permissions role to the scripts registry factory
        acl.revokePermission(scriptsRegistryFactory, acl, createPermissionsRole);

        // transfer create permissions role from this to the root address
        _transferCreatePermissionsRole(_dao, _root);
    }

    function _createAppManagerRole(Kernel _dao, address _to) internal {
        ACL acl = ACL(_dao.acl());
        bytes32 appManagerRole = _dao.APP_MANAGER_ROLE();
        acl.createPermission(_to, _dao, appManagerRole, address(this));
    }

    function _removeAppManagerRole(Kernel _dao, address _from) internal {
        ACL acl = ACL(_dao.acl());
        bytes32 appManagerRole = _dao.APP_MANAGER_ROLE();
        acl.revokePermission(_from, _dao, appManagerRole);
        acl.removePermissionManager(_dao, appManagerRole);
    }

    function _transferCreatePermissionsRole(Kernel _dao, address _to) internal {
        ACL acl = ACL(_dao.acl());
        bytes32 createPermissionsRole = acl.CREATE_PERMISSIONS_ROLE();
        acl.revokePermission(address(this), acl, createPermissionsRole);
        acl.grantPermission(_to, acl, createPermissionsRole);
        acl.setPermissionManager(_to, acl, createPermissionsRole);
    }
}
