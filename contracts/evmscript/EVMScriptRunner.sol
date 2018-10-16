/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "../apps/AppStorage.sol";
import "../kernel/KernelConstants.sol";
import "../common/Initializable.sol";


contract EVMScriptRunner is AppStorage, Initializable, EVMScriptRegistryConstants, KernelConstants {
    string private constant ERROR_EXECUTOR_UNAVAILABLE = "EVMRUN_EXECUTOR_UNAVAILABLE";
    string private constant ERROR_EXECUTION_REVERTED = "EVMRUN_EXECUTION_REVERTED";
    string private constant ERROR_PROTECTED_STATE_MODIFIED = "EVMRUN_PROTECTED_STATE_MODIFIED";

    event ScriptResult(address indexed executor, bytes script, bytes input, bytes returnData);

    function getExecutor(bytes _script) public view returns (IEVMScriptExecutor) {
        return IEVMScriptExecutor(getExecutorRegistry().getScriptExecutor(_script));
    }

    function runScript(bytes _script, bytes _input, address[] _blacklist)
        internal
        isInitialized
        protectState
        returns (bytes)
    {
        // TODO: Too much data flying around, maybe extracting spec id here is cheaper
        IEVMScriptExecutor executor = getExecutor(_script);
        require(address(executor) != address(0), ERROR_EXECUTOR_UNAVAILABLE);

        bytes4 sig = executor.execScript.selector;
        bytes memory calldata = abi.encodeWithSelector(sig, _script, _input, _blacklist);
        require(address(executor).delegatecall(calldata), ERROR_EXECUTION_REVERTED);

        bytes memory output = returnedDataDecoded();

        emit ScriptResult(address(executor), _script, _input, output);

        return output;
    }

    function getExecutorRegistry() internal view returns (IEVMScriptRegistry) {
        address registryAddr = kernel().getApp(APP_ADDR_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID);
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
        address preKernel = address(kernel());
        bytes32 preAppId = appId();
        _; // exec
        require(address(kernel()) == preKernel, ERROR_PROTECTED_STATE_MODIFIED);
        require(appId() == preAppId, ERROR_PROTECTED_STATE_MODIFIED);
    }
}
