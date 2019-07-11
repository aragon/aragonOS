pragma solidity 0.4.24;


import "../../../evmscript/executors/BaseEVMScriptExecutor.sol";

contract EVMScriptExecutorNoReturnMock is BaseEVMScriptExecutor {
    bytes32 internal constant EXECUTOR_TYPE = keccak256("NO_RETURN_SCRIPT");

    function execScript(bytes, bytes, address[]) external isInitialized returns (bytes) {
        assembly {
            stop
        }
    }

    function executorType() external pure returns (bytes32) {
        return EXECUTOR_TYPE;
    }
}
