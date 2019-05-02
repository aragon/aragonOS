pragma solidity 0.4.24;


import "../../../evmscript/executors/BaseEVMScriptExecutor.sol";

contract EVMScriptExecutorRevertMock is BaseEVMScriptExecutor {
    string public constant ERROR_MOCK_REVERT = "MOCK_REVERT";
    bytes32 internal constant EXECUTOR_TYPE = keccak256("MOCK_REVERT_SCRIPT");

    function execScript(bytes, bytes, address[]) external isInitialized returns (bytes) {
        revert(ERROR_MOCK_REVERT);
    }

    function executorType() external pure returns (bytes32) {
        return EXECUTOR_TYPE;
    }
}
