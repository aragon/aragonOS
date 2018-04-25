pragma solidity ^0.4.18;

import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "../apps/AppStorage.sol";


contract EVMScriptRunner is AppStorage, EVMScriptRegistryConstants {
    using ScriptHelpers for bytes;

    function runScript(bytes _script, bytes _input, address[] _blacklist) protectState internal returns (bytes output) {
        // TODO: Too much data flying around, maybe extracting spec id here is cheaper
        address executorAddr = getExecutor(_script);
        require(executorAddr != address(0));

        bytes memory calldataArgs = _script.encode(_input, _blacklist);
        bytes4 sig = IEVMScriptExecutor(0).execScript.selector;

        require(executorAddr.delegatecall(sig, calldataArgs));

        bytes memory ret = returnedDataDecoded();

        require(ret.length > 0);

        return ret;
    }

    function getExecutor(bytes _script) public view returns (IEVMScriptExecutor) {
        return IEVMScriptExecutor(getExecutorRegistry().getScriptExecutor(_script));
    }

    // TODO: Internal
    function getExecutorRegistry() internal view returns (IEVMScriptRegistry) {
        address registryAddr = kernel.getApp(EVMSCRIPT_REGISTRY_APP);
        return IEVMScriptRegistry(registryAddr);
    }

    /**
    * @dev copies and returns last's call data. Needs to ABI decode first
    */
    function returnedDataDecoded() internal pure returns (bytes ret) {
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
