pragma solidity ^0.4.18;

import "../apps/AppStorage.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "./ScriptHelpers.sol";


contract EVMScriptRunner is AppStorage, EVMScriptRegistryConstants {
    using ScriptHelpers for bytes;

    function runScript(bytes script, bytes input, address[] blacklist) protectState internal returns (bytes output) {
        address registryAddr = kernel.getApp(EVMSCRIPT_REGISTRY_APP);
        // TOOD: Too much data flying around, maybe extracting spec id here is cheaper
        address executorAddr = IEVMScriptRegistry(registryAddr).getScriptExecutor(script);
        require(executorAddr != address(0));

        bytes memory calldataArgs = script.encode(input, blacklist);
        bytes4 sig = IEVMScriptExecutor(0).execScript.selector;

        require(executorAddr.delegatecall(sig, calldataArgs));

        return returnedDataDecoded();
    }

    /**
    * @dev copies and returns last's call data. Needs to ABI decode first
    */
    function returnedDataDecoded() internal view returns (bytes ret) {
        assembly {
            let size := returndatasize
            switch size
            case 0 {}
            default {
                ret := mload(0x40) // free mem ptr get
                mstore(0x40, add(ret, add(size, 0x20))) // free mem ptr set
                returndatacopy(ret, 0x20, sub(size, 0x20)) // copy return data
            }
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
