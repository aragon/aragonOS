pragma solidity 0.4.18;

import "../evmscript/EVMScriptRegistry.sol";

import "../evmscript/executors/CallsScript.sol";
import "../evmscript/executors/DelegateScript.sol";
import "../evmscript/executors/DeployDelegateScript.sol";

import "./AppProxyFactory.sol";
import "../kernel/Kernel.sol";
import "../acl/ACL.sol";

contract EVMScriptRegistryFactory is AppProxyFactory, EVMScriptRegistryConstants {
    address public baseReg;
    address public baseCalls;
    address public baseDel;
    address public baseDeployDel;

    function EVMScriptRegistryFactory() public {
        baseReg = address(new EVMScriptRegistry());
        baseCalls = address(new CallsScript());
        baseDel = address(new DelegateScript());
        baseDeployDel = address(new DeployDelegateScript());
    }

    function newEVMScriptRegistry(Kernel dao, address root) public returns (EVMScriptRegistry reg) {
        dao.setApp(dao.APP_BASES_NAMESPACE(), EVMSCRIPT_REGISTRY_APP_ID, baseReg);
        reg = EVMScriptRegistry(newAppProxyPinned(dao, EVMSCRIPT_REGISTRY_APP_ID));

        ACL acl = ACL(dao.acl());

        dao.setApp(dao.APP_ADDR_NAMESPACE(), EVMSCRIPT_REGISTRY_APP, reg);
        acl.createPermission(this, reg, reg.REGISTRY_MANAGER(), this);

        reg.addScriptExecutor(baseCalls);     // spec 1 = CallsScript
        reg.addScriptExecutor(baseDel);       // spec 2 = DelegateScript
        reg.addScriptExecutor(baseDeployDel); // spec 3 = DeployDelegateScript

        acl.revokePermission(this, reg, reg.REGISTRY_MANAGER());
        acl.setPermissionManager(root, reg, reg.REGISTRY_MANAGER());

        return reg;
    }
}
