pragma solidity 0.4.24;

import "../acl/IACL.sol";
import "../acl/ACL.sol";
import "../kernel/IKernel.sol";
import "../kernel/Kernel.sol";
import "../kernel/KernelProxy.sol";
import "../kill-switch/KillSwitch.sol";
import "../kill-switch/IssuesRegistry.sol";
import "./EVMScriptRegistryFactory.sol";


contract DAOFactory {
    string private constant ERROR_MISSING_BASE_KILL_SWITCH = "DF_MISSING_BASE_KILL_SWITCH";

    IKernel public baseKernel;
    IACL public baseACL;
    KillSwitch public baseKillSwitch;
    EVMScriptRegistryFactory public regFactory;

    event DeployDAO(address dao);
    event DeployKillSwitch(address killSwitch);
    event DeployEVMScriptRegistry(address registry);

    /**
    * @notice Create a new DAOFactory, creating DAOs with Kernels proxied to `_baseKernel`, ACLs proxied to `_baseACL`, and new EVMScriptRegistries created from `_scriptsRegistryFactory`.
    * @param _baseKernel Base Kernel
    * @param _baseACL Base ACL
    * @param _baseKillSwitch Base KillSwitch
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
            regFactory = _scriptsRegistryFactory;
        }
        if (address(_baseKillSwitch) != address(0)) {
            baseKillSwitch = _baseKillSwitch;
        }

        baseKernel = _baseKernel;
        baseACL = _baseACL;
    }

    /**
    * @notice Create a new DAO with `_root` set as the initial admin
    * @param _root Address that will be granted control to setup DAO permissions
    * @return Newly created DAO
    */
    function newDAO(address _root) public returns (Kernel) {
        if (address(regFactory) == address(0)) {
            return _createDAO(_root);
        }

        Kernel dao = _createDAO(address(this));
        ACL acl = ACL(dao.acl());

        // load roles
        bytes32 appManagerRole = dao.APP_MANAGER_ROLE();
        bytes32 createPermissionsRole = acl.CREATE_PERMISSIONS_ROLE();

        // grant app manager permissions to factory and deploy EVM scripts registry
        acl.createPermission(regFactory, dao, appManagerRole, address(this));
        _createEVMScriptRegistry(dao, acl, createPermissionsRole);

        // roll back app manager permissions
        acl.revokePermission(regFactory, dao, appManagerRole);
        acl.removePermissionManager(dao, appManagerRole);

        // transfer create permissions roles to root address
        acl.revokePermission(address(this), acl, createPermissionsRole);
        acl.grantPermission(_root, acl, createPermissionsRole);
        acl.setPermissionManager(_root, acl, createPermissionsRole);

        return dao;
    }

    /**
    * @notice Create a new DAO with `_root` set as the initial admin and `_issuesRegistry` as the source of truth for kill-switch purposes
    * @param _root Address that will be granted control to setup DAO permissions
    * @param _issuesRegistry Address of the registry of issues that will be used to detect critical situations by the kill switch
    * @return Newly created DAO
    */
    function newDAOWithKillSwitch(address _root, IssuesRegistry _issuesRegistry) public returns (Kernel) {
        require(address(baseKillSwitch) != address(0), ERROR_MISSING_BASE_KILL_SWITCH);

        Kernel dao = _createDAO(address(this));
        ACL acl = ACL(dao.acl());

        // load roles
        bytes32 appManagerRole = dao.APP_MANAGER_ROLE();
        bytes32 createPermissionsRole = acl.CREATE_PERMISSIONS_ROLE();

        // grant app manager permissions to this and deploy kill switch
        acl.createPermission(address(this), dao, appManagerRole, address(this));
        _createKillSwitch(dao, acl, _issuesRegistry);

        // deploy EVM scripts registry if required
        if (address(regFactory) != address(0)) {
            acl.grantPermission(regFactory, dao, appManagerRole);
            _createEVMScriptRegistry(dao, acl, createPermissionsRole);
            acl.revokePermission(regFactory, dao, appManagerRole);
        }

        // roll back app manager permissions
        acl.revokePermission(address(this), dao, appManagerRole);
        acl.removePermissionManager(dao, appManagerRole);

        // transfer create permissions roles to root address
        acl.revokePermission(address(this), acl, createPermissionsRole);
        acl.grantPermission(_root, acl, createPermissionsRole);
        acl.setPermissionManager(_root, acl, createPermissionsRole);

        return dao;
    }

    function _createDAO(address _permissionsCreator) internal returns (Kernel) {
        Kernel dao = Kernel(new KernelProxy(baseKernel));
        dao.initialize(baseACL, _permissionsCreator);
        emit DeployDAO(address(dao));
        return dao;
    }

    function _createEVMScriptRegistry(Kernel _dao, ACL _acl, bytes32 _createPermissionsRole) internal {
        _acl.grantPermission(regFactory, _acl, _createPermissionsRole);
        EVMScriptRegistry scriptsRegistry = regFactory.newEVMScriptRegistry(_dao);
        emit DeployEVMScriptRegistry(address(scriptsRegistry));
        _acl.revokePermission(regFactory, _acl, _createPermissionsRole);
    }

    function _createKillSwitch(Kernel _dao, ACL _acl, IssuesRegistry _issuesRegistry) internal {
        bytes32 killSwitchAppID = _dao.DEFAULT_KILL_SWITCH_APP_ID();
        bytes memory initializeData = abi.encodeWithSelector(baseKillSwitch.initialize.selector, _issuesRegistry);
        KillSwitch killSwitch = KillSwitch(_dao.newAppInstance(killSwitchAppID, baseKillSwitch, initializeData, true));
        _allowKillSwitchCoreInstances(_dao, _acl, killSwitch);
        emit DeployKillSwitch(address(killSwitch));
    }

    function _allowKillSwitchCoreInstances(Kernel _dao, ACL _acl, KillSwitch _killSwitch) internal {
        // create change whitelisted instances role for this
        bytes32 changeWhitelistedInstancesRole = _killSwitch.CHANGE_WHITELISTED_INSTANCES_ROLE();
        _acl.createPermission(address(this), _killSwitch, changeWhitelistedInstancesRole, address(this));

        // whitelist core instances: kill switch, acl and kernel
        _killSwitch.setWhitelistedInstance(address(_dao), true);
        _killSwitch.setWhitelistedInstance(address(_acl), true);
        _killSwitch.setWhitelistedInstance(address(_killSwitch), true);

        // revoke and remove change whitelisted instances role from this
        _acl.revokePermission(address(this), _killSwitch, changeWhitelistedInstancesRole);
        _acl.removePermissionManager(_killSwitch, changeWhitelistedInstancesRole);
    }
}
