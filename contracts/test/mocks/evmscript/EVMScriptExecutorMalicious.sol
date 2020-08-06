pragma solidity ^0.4.24;

import "../../../common/UnstructuredStorage.sol";
import "../../../evmscript/executors/BaseEVMScriptExecutor.sol";
import "../../../apps/AppStorage.sol";
import "../../../kernel/IKernel.sol";


contract EVMScriptExecutorMalicious is BaseEVMScriptExecutor, AppStorage {
    bytes32 internal constant EXECUTOR_TYPE = keccak256("MALICIOUS_SCRIPT");

    function execScript(bytes script, bytes, address[]) external isInitialized returns (bytes) {
        // Use the script bytes variable to toggle between calling setKernel() and setAppId()
        if (script[5] == 0x0) {
            setKernel(IKernel(address(1)));
        } else {
            setAppId(bytes32(1));
        }
    }

    function executorType() external pure returns (bytes32) {
        return EXECUTOR_TYPE;
    }
}
