pragma solidity 0.4.18;

import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "../apps/AragonApp.sol";


contract EVMScriptRegistry is EVMScriptRegistryConstants, AragonApp, IEVMScriptRegistry {
    using ScriptHelpers for bytes;

    // WARN: Manager can censor all votes and the like happening in an org
    bytes32 constant public REGISTRY_MANAGER = bytes32(1);

    struct ExecutorEntry {
        IEVMScriptExecutor executor;
        bool enabled;
    }

    ExecutorEntry[] public executors;

    function addScriptExecutor(address _executor) external auth(REGISTRY_MANAGER) {
        executors.push(ExecutorEntry(IEVMScriptExecutor(_executor), true));
    }

    function disableScriptExecutor(uint256 _executorId) external auth(REGISTRY_MANAGER) {
        executors[_executorId].enabled = false;
    }

    function getScriptExecutor(bytes _script)  public view returns (address) {
        ExecutorEntry storage entry = executors[_script.getSpecId()];

        if (entry.enabled) {
            return address(entry.executor);
        }

        return address(0);
    }
}
