/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "../apps/AppStorage.sol";
import "../common/Initializable.sol";


contract EVMScriptRunner is AppStorage, Initializable, EVMScriptRegistryConstants {
    using ScriptHelpers for bytes;

    event ScriptResult(address indexed executor, bytes script, bytes input, bytes returnData);

    function getExecutor(bytes _script) public view returns (IEVMScriptExecutor) {
        return IEVMScriptExecutor(getExecutorRegistry().getScriptExecutor(_script));
    }

    function runScript(bytes _script, bytes _input, address[] _blacklist)
        internal
        isInitialized
        protectState
        returns (bytes output)
    {
        // TODO: Too much data flying around, maybe extracting spec id here is cheaper
        IEVMScriptExecutor executor = getExecutor(_script);
        require(address(executor) != address(0));

        bytes memory calldataArgs = _script.encode(_input, _blacklist);
        bytes4 sig = executor.execScript.selector;

        require(address(executor).delegatecall(sig, calldataArgs));

        output = returnedDataDecoded();

        ScriptResult(address(executor), _script, _input, output);
    }

    function getExecutorRegistry() internal view returns (IEVMScriptRegistry) {
        address registryAddr = kernel().getApp(EVMSCRIPT_REGISTRY_APP);
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
        require(address(kernel()) == preKernel);
        require(appId() == preAppId);
    }
}
