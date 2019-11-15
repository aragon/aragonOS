pragma solidity ^0.5.1;

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
        address kernelProxy = address(new KernelProxy(baseKernel));
        Kernel dao = Kernel(kernelProxy);

        if (address(regFactory) == address(0)) {
            dao.initialize(baseACL, _root);
        } else {
            dao.initialize(baseACL, address(this));

            address aclAddr = address(dao.acl());
            ACL acl = ACL(aclAddr);
            bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();
            bytes32 appManagerRole = dao.APP_MANAGER_ROLE();

            acl.grantPermission(address(regFactory), address(acl), permRole);

            acl.createPermission(address(regFactory), address(dao), appManagerRole, address(this));

            EVMScriptRegistry reg = regFactory.newEVMScriptRegistry(dao);
            emit DeployEVMScriptRegistry(address(reg));

            // Clean up permissions
            // First, completely reset the APP_MANAGER_ROLE
            acl.revokePermission(address(regFactory), address(dao), appManagerRole);
            acl.removePermissionManager(address(dao), appManagerRole);

            // Then, make root the only holder and manager of CREATE_PERMISSIONS_ROLE
            acl.revokePermission(address(regFactory), address(acl), permRole);
            acl.revokePermission(address(this), address(acl), permRole);
            acl.grantPermission(address(_root), address(acl), permRole);
            acl.setPermissionManager(address(_root), address(acl), permRole);
        }

        emit DeployDAO(address(dao));

        return dao;
    }
}
