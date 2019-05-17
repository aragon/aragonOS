pragma solidity 0.4.24;

import "../acl/IACL.sol";
import "../acl/ACL.sol";
import "../kernel/IKernel.sol";
import "../kernel/Kernel.sol";
import "../kernel/KernelProxy.sol";
import "../kill_switch/KillSwitch.sol";
import "../kill_switch/IssuesRegistry.sol";
import "./EVMScriptRegistryFactory.sol";


contract DAOFactory {
    string private constant ERROR_MISSING_BASE_KILL_SWITCH = "DF_MISSING_BASE_KILL_SWITCH";

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
        if (address(scriptsRegistryFactory) == address(0)) {
            return _createDAO(_root);
        }

        Kernel dao = _createDAO(address(this));
        ACL acl = ACL(dao.acl());
        _setupEVMScriptRegistry(dao, acl, _root);
        return dao;
    }

    /**
    * @notice Create a new DAO with `_root` set as the initial admin and `_issuesRegistry` as the source of truth for kill-switch purpose
    * @param _root Address that will be granted control to setup DAO permissions
    * @param _issuesRegistry Address of the registry of issues that will be used in case of critical situations by the kill switch
    * @return Newly created DAO
    */
    function newDAOWithKillSwitch(address _root, IssuesRegistry _issuesRegistry) public returns (Kernel) {
        require(address(baseKillSwitch) != address(0), ERROR_MISSING_BASE_KILL_SWITCH);

        Kernel dao = _createDAO(address(this));
        ACL acl = ACL(dao.acl());
        _createKillSwitch(dao, acl, _issuesRegistry);

        if (address(scriptsRegistryFactory) == address(0)) {
            _transferCreatePermissionsRole(dao, acl, address(this), _root);
        } else {
            _setupEVMScriptRegistry(dao, acl, _root);
        }

        return dao;
    }

    function _createDAO(address _permissionsCreator) internal returns (Kernel) {
        Kernel dao = Kernel(new KernelProxy(baseKernel));
        dao.initialize(baseACL, _permissionsCreator);
        emit DeployDAO(address(dao));
        return dao;
    }

    function _createKillSwitch(Kernel _dao, ACL _acl, IssuesRegistry _issuesRegistry) internal {
        // create app manager role for this
        _createAppManagerRole(_dao, _acl, address(this));

        // create kill switch instance and set it as default
        bytes32 killSwitchAppID = _dao.DEFAULT_KILL_SWITCH_APP_ID();
        bytes memory initializeData = abi.encodeWithSelector(baseKillSwitch.initialize.selector, _issuesRegistry);
        _dao.newAppInstance(killSwitchAppID, baseKillSwitch, initializeData, true);
        _allowKillSwitchCoreInstances(_dao, _acl);

        // remove app manager role permissions from this
        _removeAppManagerRole(_dao, _acl, address(this));
    }

    function _allowKillSwitchCoreInstances(Kernel _dao, ACL _acl) internal {
        KillSwitch killSwitch = KillSwitch(_dao.killSwitch());

        // create allow instances role for this
        bytes32 setAllowedInstancesRole = killSwitch.SET_ALLOWED_INSTANCES_ROLE();
        _acl.createPermission(address(this), killSwitch, setAllowedInstancesRole, address(this));

        // allow calls to core instances: kill switch, acl and kernel
        killSwitch.setAllowedInstance(address(_dao), true);
        killSwitch.setAllowedInstance(address(_acl), true);
        killSwitch.setAllowedInstance(address(killSwitch), true);

        // remove allow instances role from this
        _acl.revokePermission(address(this), killSwitch, setAllowedInstancesRole);
        _acl.removePermissionManager(killSwitch, setAllowedInstancesRole);
    }

    function _setupEVMScriptRegistry(Kernel _dao, ACL _acl, address _root) internal {
        // grant permissions to script registry factory
        _grantCreatePermissionsRole(_dao, _acl, scriptsRegistryFactory);
        _createAppManagerRole(_dao, _acl, scriptsRegistryFactory);

        // create evm scripts registry
        EVMScriptRegistry scriptsRegistry = scriptsRegistryFactory.newEVMScriptRegistry(_dao);
        emit DeployEVMScriptRegistry(address(scriptsRegistry));

        // remove permissions from scripts registry factory and transfer to root address
        _removeAppManagerRole(_dao, _acl, scriptsRegistryFactory);
        _transferCreatePermissionsRole(_dao, _acl, scriptsRegistryFactory, _root);
    }

    function _grantCreatePermissionsRole(Kernel _dao, ACL _acl, address _to) internal {
        bytes32 createPermissionsRole = _acl.CREATE_PERMISSIONS_ROLE();
        _acl.grantPermission(_to, _acl, createPermissionsRole);
    }

    function _createAppManagerRole(Kernel _dao, ACL _acl, address _to) internal {
        bytes32 appManagerRole = _dao.APP_MANAGER_ROLE();
        _acl.createPermission(_to, _dao, appManagerRole, address(this));
    }

    function _removeAppManagerRole(Kernel _dao, ACL _acl, address _from) internal {
        bytes32 appManagerRole = _dao.APP_MANAGER_ROLE();
        _acl.revokePermission(_from, _dao, appManagerRole);
        _acl.removePermissionManager(_dao, appManagerRole);
    }

    function _transferCreatePermissionsRole(Kernel _dao, ACL _acl, address _from, address _to) internal {
        bytes32 createPermissionsRole = _acl.CREATE_PERMISSIONS_ROLE();
        _acl.revokePermission(_from, _acl, createPermissionsRole);
        if (_from != address(this)) {
            _acl.revokePermission(address(this), _acl, createPermissionsRole);
        }

        _acl.grantPermission(_to, _acl, createPermissionsRole);
        _acl.setPermissionManager(_to, _acl, createPermissionsRole);
    }
}
