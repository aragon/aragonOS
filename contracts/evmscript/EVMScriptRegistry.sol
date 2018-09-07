pragma solidity 0.4.24;

import "../apps/AragonApp.sol";
import "./ScriptHelpers.sol";
import "./IEVMScriptExecutor.sol";
import "./IEVMScriptRegistry.sol";


/* solium-disable function-order */
// Allow public initialize() to be first
contract EVMScriptRegistry is IEVMScriptRegistry, EVMScriptRegistryConstants, AragonApp {
    using ScriptHelpers for bytes;

    // bytes32 constant public REGISTRY_ADD_EXECUTOR_ROLE = keccak256("REGISTRY_ADD_EXECUTOR_ROLE");
    bytes32 constant public REGISTRY_ADD_EXECUTOR_ROLE = 0xc4e90f38eea8c4212a009ca7b8947943ba4d4a58d19b683417f65291d1cd9ed2;
    // WARN: Manager can censor all votes and the like happening in an org
    // bytes32 constant public REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");
    bytes32 constant public REGISTRY_MANAGER_ROLE = 0xf7a450ef335e1892cb42c8ca72e7242359d7711924b75db5717410da3f614aa3;

    struct ExecutorEntry {
        IEVMScriptExecutor executor;
        bool enabled;
    }

    ExecutorEntry[] public executors;

    event EnableExecutor(uint256 indexed executorId, address indexed executorAddress);
    event DisableExecutor(uint256 indexed executorId, address indexed executorAddress);

    /**
    * @notice Initialize the registry
    */
    function initialize() public onlyInit {
        initialized();
        // Create empty record to begin executor IDs at 1
        executors.push(ExecutorEntry(IEVMScriptExecutor(0), false));
    }

    /**
    * @notice Add a new script executor with address `_executor` to the registry
    * @param _executor Address of the IEVMScriptExecutor that will be added to the registry
    * @return id Identifier of the executor in the registry
    */
    function addScriptExecutor(IEVMScriptExecutor _executor) external auth(REGISTRY_ADD_EXECUTOR_ROLE) returns (uint256 id) {
        uint256 executorId = executors.push(ExecutorEntry(_executor, true)) - 1;
        emit EnableExecutor(executorId, _executor);
        return executorId;
    }

    /**
    * @notice Disable script executor with ID `_executorId`
    * @param _executorId Identifier of the executor in the registry
    */
    function disableScriptExecutor(uint256 _executorId)
        external
        authP(REGISTRY_MANAGER_ROLE, arr(_executorId))
    {
        ExecutorEntry storage executorEntry = executors[_executorId];
        require(executorEntry.enabled);
        executorEntry.enabled = false;
        emit DisableExecutor(_executorId, executorEntry.executor);
    }

    /**
    * @notice Enable script executor with ID `_executorId`
    * @param _executorId Identifier of the executor in the registry
    */
    function enableScriptExecutor(uint256 _executorId)
        external
        authP(REGISTRY_MANAGER_ROLE, arr(_executorId))
    {
        ExecutorEntry storage executorEntry = executors[_executorId];
        require(!executorEntry.enabled);
        executorEntry.enabled = true;
        emit EnableExecutor(_executorId, executorEntry.executor);
    }

    /**
    * @dev Get the script executor that can execute a particular script based on its first 4 bytes
    * @param _script EVMScript being inspected
    */
    function getScriptExecutor(bytes _script) public view returns (IEVMScriptExecutor) {
        uint256 id = _script.getSpecId();

        if (id == 0 || id >= executors.length) {
            return IEVMScriptExecutor(0);
        }

        ExecutorEntry storage entry = executors[id];
        return entry.enabled ? entry.executor : IEVMScriptExecutor(0);
    }
}
