pragma solidity ^0.4.18;

import "../kernel/Kernel.sol";
import "../kernel/KernelProxy.sol";

import "../acl/ACL.sol";

import "./EVMScriptRegistryFactory.sol";


contract DAOFactory {
    address public baseKernel;
    address public baseACL;
    EVMScriptRegistryFactory public regFactory;

    event DeployDAO(address dao);
    event DeployEVMScriptRegistry(address reg);

    function DAOFactory(address _baseKernel, address _baseACL, address _regFactory) public {
        // No need to init as it cannot be killed by devops199
        if (_regFactory != address(0)) {
            regFactory = EVMScriptRegistryFactory(_regFactory);
        }

        baseKernel = _baseKernel;
        baseACL = _baseACL;
    }

    /**
    * @param _root Address that will be granted control to setup DAO permissions
    */
    function newDAO(address _root) public returns (Kernel dao) {
        dao = Kernel(new KernelProxy(baseKernel));

        address initialRoot = address(regFactory) != address(0) ? this : _root;
        dao.initialize(baseACL, initialRoot);

        ACL acl = ACL(dao.acl());

        if (address(regFactory) != address(0)) {
            bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();
            bytes32 appManagerRole = dao.APP_MANAGER_ROLE();

            acl.grantPermission(regFactory, acl, permRole);

            acl.createPermission(regFactory, dao, appManagerRole, this);

            EVMScriptRegistry reg = regFactory.newEVMScriptRegistry(dao, _root);
            DeployEVMScriptRegistry(address(reg));

            acl.revokePermission(regFactory, dao, appManagerRole);
            acl.grantPermission(_root, acl, permRole);

            acl.setPermissionManager(address(0), dao, appManagerRole);
            acl.setPermissionManager(_root, acl, permRole);
        }

        DeployDAO(dao);
    }
}
