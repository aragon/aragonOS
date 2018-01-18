pragma solidity 0.4.18;

import "../evmscript/EVMScriptRegistry.sol";

import "../evmscript/executors/CallsScript.sol";
import "../evmscript/executors/DelegateScript.sol";
import "../evmscript/executors/DeployDelegateScript.sol";

import "./AppProxyFactory.sol";
import "../kernel/Kernel.sol";

contract EVMScriptRegistryFactory is AppProxyFactory, IEVMScriptRegistry, EVMScriptRegistryConstants {
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

    function newEVMScriptRegistry(Kernel dao, address root) public returns (EVMScriptRegistry reg){
        dao.createPermission(this, dao, dao.UPGRADE_APPS_ROLE(), this);
        dao.createPermission(this, dao, dao.SET_APP_ROLE(), this);

        dao.setAppCode(EVMSCRIPT_REGISTRY_APP_ID, baseReg);
        reg = EVMScriptRegistry(newAppProxyPinned(dao, EVMSCRIPT_REGISTRY_APP_ID));
        dao.setApp(EVMSCRIPT_REGISTRY_APP, reg);
        dao.createPermission(this, reg, reg.REGISTRY_MANAGER(), this);

        reg.addScriptExecutor(baseCalls);     // spec 1 = CallsScript
        reg.addScriptExecutor(baseDel);       // spec 2 = DelegateScript
        reg.addScriptExecutor(baseDeployDel); // spec 3 = DeployDelegateScript

        dao.setPermissionManager(root, reg, reg.REGISTRY_MANAGER());

        return reg;
    }
}
