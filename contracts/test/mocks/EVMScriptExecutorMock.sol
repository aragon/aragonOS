pragma solidity 0.4.24;


import "../../evmscript/executors/BaseEVMScriptExecutor.sol";

contract EVMScriptExecutorMock is BaseEVMScriptExecutor {
    bytes32 internal constant EXECUTOR_TYPE = keccak256("MOCK_SCRIPT");

    function execScript(bytes, bytes, address[]) external isInitialized returns (bytes) {
    }

    function executorType() external pure returns (bytes32) {
        return EXECUTOR_TYPE;
    }
}
