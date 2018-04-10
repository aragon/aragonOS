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

    function newEVMScriptRegistry(Kernel _dao, address _root) public returns (EVMScriptRegistry reg) {
        reg = EVMScriptRegistry(_dao.newPinnedAppInstance(EVMSCRIPT_REGISTRY_APP_ID, baseReg, true));
        reg.initialize();

        ACL acl = ACL(_dao.acl());

        acl.createPermission(this, reg, reg.REGISTRY_MANAGER_ROLE(), this);

        reg.addScriptExecutor(baseCalls);     // spec 1 = CallsScript
        reg.addScriptExecutor(baseDel);       // spec 2 = DelegateScript
        reg.addScriptExecutor(baseDeployDel); // spec 3 = DeployDelegateScript

        acl.revokePermission(this, reg, reg.REGISTRY_MANAGER_ROLE());
        acl.setPermissionManager(_root, reg, reg.REGISTRY_MANAGER_ROLE());

        return reg;
    }
}
