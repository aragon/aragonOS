pragma solidity ^0.5.1;

import "../evmscript/IEVMScriptExecutor.sol";
import "../evmscript/EVMScriptRegistry.sol";

import "../evmscript/executors/CallsScript.sol";

import "../kernel/Kernel.sol";
import "../acl/ACL.sol";


contract EVMScriptRegistryFactory is EVMScriptRegistryConstants {
    EVMScriptRegistry public baseReg;
    IEVMScriptExecutor public baseCallScript;

    /**
    * @notice Create a new EVMScriptRegistryFactory.
    */
    constructor() public {
        baseReg = new EVMScriptRegistry();
        baseCallScript = IEVMScriptExecutor(new CallsScript());
    }

    /**
    * @notice Install a new pinned instance of EVMScriptRegistry on `_dao`.
    * @param _dao Kernel
    * @return Installed EVMScriptRegistry
    */
    function newEVMScriptRegistry(Kernel _dao) public returns (EVMScriptRegistry reg) {
        bytes memory initPayload = abi.encodeWithSelector(reg.initialize.selector);
        reg = EVMScriptRegistry(address(_dao.newPinnedAppInstance(EVMSCRIPT_REGISTRY_APP_ID, address(baseReg), initPayload, true)));

        ACL acl = ACL(address(_dao.acl()));

        acl.createPermission(address(this), address(reg), reg.REGISTRY_ADD_EXECUTOR_ROLE(), address(this));

        reg.addScriptExecutor(baseCallScript);     // spec 1 = CallsScript

        // Clean up the permissions
        acl.revokePermission(address(this), address(reg), reg.REGISTRY_ADD_EXECUTOR_ROLE());
        acl.removePermissionManager(address(reg), reg.REGISTRY_ADD_EXECUTOR_ROLE());

        return reg;
    }
}
