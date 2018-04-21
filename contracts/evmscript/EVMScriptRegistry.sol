pragma solidity ^0.4.18;

import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "../apps/AragonApp.sol";


contract EVMScriptRegistry is IEVMScriptRegistry, EVMScriptRegistryConstants, AragonApp {
    using ScriptHelpers for bytes;

    // WARN: Manager can censor all votes and the like happening in an org
    bytes32 constant public REGISTRY_MANAGER_ROLE = bytes32(1);

    struct ExecutorEntry {
        address executor;
        bool enabled;
    }

    ExecutorEntry[] public executors;

    function initialize() onlyInit public {
        initialized();
        // Create empty record to begin executor IDs at 1
        executors.push(ExecutorEntry(address(0), false));
    }

    function addScriptExecutor(address _executor) external auth(REGISTRY_MANAGER_ROLE) returns (uint id) {
        return executors.push(ExecutorEntry(_executor, true));
    }

    function disableScriptExecutor(uint256 _executorId) external auth(REGISTRY_MANAGER_ROLE) {
        executors[_executorId].enabled = false;
    }

    function getScriptExecutor(bytes _script) public view returns (address) {
        uint256 id = _script.getSpecId();

        if (id == 0 || id >= executors.length) {
            return address(0);
        }

        ExecutorEntry storage entry = executors[id];
        return entry.enabled ? entry.executor : address(0);
    }
}
