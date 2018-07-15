pragma solidity 0.4.18;

import "../apps/AragonApp.sol";
import "../kernel/IKernel.sol";

import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";


contract EVMScriptRegistry is IEVMScriptRegistry, EVMScriptRegistryConstants, AragonApp {
    using ScriptHelpers for bytes;

    // WARN: Manager can censor all votes and the like happening in an org
    // bytes32 constant public REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");
    bytes32 constant public REGISTRY_MANAGER_ROLE = 0xf7a450ef335e1892cb42c8ca72e7242359d7711924b75db5717410da3f614aa3;

    struct ExecutorEntry {
        address executor;
        bool enabled;
    }

    ExecutorEntry[] public executors;

    /**
    * @dev Constructor that allows a deployer to choose if the base instance should be connected to
    *      a kernel or petrified immediately.
    */
    function EVMScriptRegistry(IKernel _kernel) AragonApp(_kernel) public {}

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
