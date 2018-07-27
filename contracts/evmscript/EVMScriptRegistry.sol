pragma solidity 0.4.18;

import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";

import "../apps/AragonApp.sol";


/* solium-disable function-order */
// Allow public initialize() to be first
contract EVMScriptRegistry is IEVMScriptRegistry, EVMScriptRegistryConstants, AragonApp {
    using ScriptHelpers for bytes;

    // WARN: Manager can censor all votes and the like happening in an org
    // bytes32 constant public REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");
    bytes32 constant public REGISTRY_MANAGER_ROLE = 0xf7a450ef335e1892cb42c8ca72e7242359d7711924b75db5717410da3f614aa3;

    struct ExecutorEntry {
        IEVMScriptExecutor executor;
        bool enabled;
    }

    ExecutorEntry[] public executors;

    function initialize() public onlyInit {
        initialized();
        // Create empty record to begin executor IDs at 1
        executors.push(ExecutorEntry(IEVMScriptExecutor(0), false));
    }

    function addScriptExecutor(IEVMScriptExecutor _executor) external auth(REGISTRY_MANAGER_ROLE) returns (uint id) {
        return executors.push(ExecutorEntry(_executor, true));
    }

    function disableScriptExecutor(uint256 _executorId) external auth(REGISTRY_MANAGER_ROLE) {
        executors[_executorId].enabled = false;
    }

    function getScriptExecutor(bytes _script) public view returns (IEVMScriptExecutor) {
        uint256 id = _script.getSpecId();

        if (id == 0 || id >= executors.length) {
            return IEVMScriptExecutor(0);
        }

        ExecutorEntry storage entry = executors[id];
        return entry.enabled ? entry.executor : IEVMScriptExecutor(0);
    }
}
