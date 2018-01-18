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
        address executor;
        bool enabled;
    }

    ExecutorEntry[] public executors;

    function addScriptExecutor(address _executor) external auth(REGISTRY_MANAGER) returns (uint id) {
        // cheaply creates empty record so first index is 1
        executors.length += executors.length == 0 ? 2 : 1;
        id = executors.length - 1;
        executors[id].executor = _executor;
        executors[id].enabled = true;
    }

    function disableScriptExecutor(uint256 _executorId) external auth(REGISTRY_MANAGER) {
        executors[_executorId].enabled = false;
    }

    function getScriptExecutor(bytes _script) public view returns (address) {
        uint256 id = _script.getSpecId();

        if (id == 0 || id >= executors.length) {
            return address(0);
        }

        ExecutorEntry memory entry = executors[id];
        return entry.enabled ? entry.executor : address(0);
    }
}
