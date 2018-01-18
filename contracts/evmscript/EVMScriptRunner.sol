pragma solidity ^0.4.18;

import "../apps/AppStorage.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";


contract EVMScriptRunner is AppStorage, EVMScriptRegistryConstants {
    function runScript(bytes _script, bytes _input, address[] blacklist) protectState returns (bytes output) {
        address registryAddr = kernel.getApp(EVMSCRIPT_REGISTRY_APP);
        IEVMScriptRegistry registry = IEVMScriptRegistry(registryAddr);
        address executorAddr = IEVMScriptExecutor(registry.getScriptExecutor(_script));
        if (executorAddr != 0) {
            // TODO: Encode delegate call payload!
            // output = executor.delegatecall(..., _script, _input);
        }
    }

    modifier protectState {
        address preKernel = kernel;
        bytes32 preAppId = appId;
        _; // exec
        require(kernel == preKernel);
        require(appId == preAppId);
    }
}
