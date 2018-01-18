pragma solidity ^0.4.18;

import "../apps/AppStorage.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "./ScriptHelpers.sol";


contract EVMScriptRunner is AppStorage, EVMScriptRegistryConstants {
    using ScriptHelpers for bytes;

    function runScript(bytes script, bytes input, address[] blacklist) protectState returns (bytes output) {
        address registryAddr = kernel.getApp(EVMSCRIPT_REGISTRY_APP);
        IEVMScriptRegistry registry = IEVMScriptRegistry(registryAddr);
        // TOOD: Too much data flying around, maybe extracting spec id here is cheaper
        address executorAddr = registry.getScriptExecutor(script);
        require(executorAddr != address(0));

        bytes memory calldataArgs = script.encode(input, blacklist);
        bytes4 sig = IEVMScriptExecutor(0).execScript.selector;

        require(executorAddr.delegatecall(sig, calldataArgs));

        return returnedData();
    }

    /**
    * @dev copies and returns last's call data
    */
    function returnedData() internal view returns (bytes ret) {
        assembly {
            let size := returndatasize
            ret := mload(0x40) // free mem ptr get
            mstore(0x40, add(ret, add(size, 0x20))) // free mem ptr set
            mstore(ret, size) // set array length
            returndatacopy(add(ret, 0x20), 0, size) // copy return data
        }
        return ret;
    }

    modifier protectState {
        address preKernel = kernel;
        bytes32 preAppId = appId;
        _; // exec
        require(kernel == preKernel);
        require(appId == preAppId);
    }
}
