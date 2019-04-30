pragma solidity 0.4.24;

import "../kernel/IKernel.sol";
import "../kernel/Kernel.sol";
import "../kernel/KernelProxy.sol";

import "../acl/IACL.sol";
import "../acl/ACL.sol";

import "./EVMScriptRegistryFactory.sol";


contract DAOFactory {
    IKernel public baseKernel;
    IACL public baseACL;
    EVMScriptRegistryFactory public regFactory;

    event DeployDAO(address dao);
    event DeployEVMScriptRegistry(address reg);

    /**
    * @notice Create a new DAOFactory, creating DAOs with Kernels proxied to `_baseKernel`, ACLs proxied to `_baseACL`, and new EVMScriptRegistries created from `_regFactory`.
    * @param _baseKernel Base Kernel
    * @param _baseACL Base ACL
    * @param _regFactory EVMScriptRegistry factory
    */
    constructor(IKernel _baseKernel, IACL _baseACL, EVMScriptRegistryFactory _regFactory) public {
        // No need to init as it cannot be killed by devops199
        if (address(_regFactory) != address(0)) {
            regFactory = _regFactory;
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
        Kernel dao = Kernel(new KernelProxy(baseKernel));

        if (address(regFactory) == address(0)) {
            dao.initialize(baseACL, _root);
        } else {
            dao.initialize(baseACL, this);
            _setupNewDaoPermissions(_root, dao);
        }

        emit DeployDAO(address(dao));
        return dao;
    }

    function _setupNewDaoPermissions(address _root, Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());
        bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();
        bytes32 appManagerRole = _dao.APP_MANAGER_ROLE();

        acl.grantPermission(regFactory, acl, permRole);

        acl.createPermission(regFactory, _dao, appManagerRole, this);

        EVMScriptRegistry reg = regFactory.newEVMScriptRegistry(_dao);
        emit DeployEVMScriptRegistry(address(reg));

        // Clean up permissions
        // First, completely reset the APP_MANAGER_ROLE
        acl.revokePermission(regFactory, _dao, appManagerRole);
        acl.removePermissionManager(_dao, appManagerRole);

        // Then, make root the only holder and manager of CREATE_PERMISSIONS_ROLE
        acl.revokePermission(regFactory, acl, permRole);
        acl.revokePermission(this, acl, permRole);
        acl.grantPermission(_root, acl, permRole);
        acl.setPermissionManager(_root, acl, permRole);
    }
}
