pragma solidity 0.4.24;

import "../../../evmscript/IEVMScriptRegistry.sol";


contract EVMScriptRegistryConstantsMock is EVMScriptRegistryConstants {
    function getEVMScriptRegistryAppId() external pure returns (bytes32) { return EVMSCRIPT_REGISTRY_APP_ID; }
}
