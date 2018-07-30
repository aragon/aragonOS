pragma solidity 0.4.18;

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

    function DAOFactory(IKernel _baseKernel, IACL _baseACL, EVMScriptRegistryFactory _regFactory) public {
        // No need to init as it cannot be killed by devops199
        if (address(_regFactory) != address(0)) {
            regFactory = _regFactory;
        }

        baseKernel = _baseKernel;
        baseACL = _baseACL;
    }

    /**
    * @param _root Address that will be granted control to setup DAO permissions
    */
    function newDAO(address _root) public returns (Kernel dao) {
        dao = Kernel(new KernelProxy(baseKernel));

        if (address(regFactory) == address(0)) {
            dao.initialize(baseACL, _root);
        } else {
            dao.initialize(baseACL, this);

            ACL acl = ACL(dao.acl());
            bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();
            bytes32 appManagerRole = dao.APP_MANAGER_ROLE();

            acl.grantPermission(regFactory, acl, permRole);

            acl.createPermission(regFactory, dao, appManagerRole, this);

            EVMScriptRegistry reg = regFactory.newEVMScriptRegistry(dao, _root);
            DeployEVMScriptRegistry(address(reg));

            acl.revokePermission(regFactory, dao, appManagerRole);
            acl.revokePermission(regFactory, acl, permRole);
            acl.revokePermission(this, acl, permRole);
            acl.grantPermission(_root, acl, permRole);

            acl.removePermissionManager(dao, appManagerRole);
            acl.setPermissionManager(_root, acl, permRole);
        }

        DeployDAO(address(dao));
    }
}
