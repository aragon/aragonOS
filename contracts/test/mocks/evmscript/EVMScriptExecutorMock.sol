pragma solidity 0.4.24;


import "../../../evmscript/executors/BaseEVMScriptExecutor.sol";

contract EVMScriptExecutorMock is BaseEVMScriptExecutor {
    bytes32 internal constant EXECUTOR_TYPE = keccak256("MOCK_SCRIPT");

    function execScript(bytes _script, bytes, address[]) external isInitialized returns (bytes) {
        // Return full input script if it's more than just the spec ID, otherwise return an empty
        // bytes array
        if (_script.length > SCRIPT_START_LOCATION) {
            return _script;
        }
    }

    function executorType() external pure returns (bytes32) {
        return EXECUTOR_TYPE;
    }
}
