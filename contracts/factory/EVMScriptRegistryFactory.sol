pragma solidity 0.4.18;

import "../evmscript/IEVMScriptExecutor.sol";
import "../evmscript/EVMScriptRegistry.sol";

import "../evmscript/executors/CallsScript.sol";

import "./AppProxyFactory.sol";
import "../kernel/Kernel.sol";
import "../acl/ACL.sol";


contract EVMScriptRegistryFactory is AppProxyFactory, EVMScriptRegistryConstants {
    EVMScriptRegistry public baseReg;
    IEVMScriptExecutor public baseCallScript;

    function EVMScriptRegistryFactory() public {
        baseReg = new EVMScriptRegistry();
        baseCallScript = IEVMScriptExecutor(new CallsScript());
    }

    function newEVMScriptRegistry(Kernel _dao, address _root) public returns (EVMScriptRegistry reg) {
        reg = EVMScriptRegistry(_dao.newPinnedAppInstance(EVMSCRIPT_REGISTRY_APP_ID, baseReg, true));
        reg.initialize();

        ACL acl = ACL(_dao.acl());

        acl.createPermission(this, reg, reg.REGISTRY_MANAGER_ROLE(), this);

        reg.addScriptExecutor(baseCallScript);     // spec 1 = CallsScript

        acl.revokePermission(this, reg, reg.REGISTRY_MANAGER_ROLE());
        acl.setPermissionManager(_root, reg, reg.REGISTRY_MANAGER_ROLE());

        return reg;
    }
}
