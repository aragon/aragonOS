pragma solidity 0.4.18;


contract EVMScriptRegistryConstants {
    // repeated definitions from KernelStorage, to avoid out of gas issues
    bytes32 constant public ETH_NODE = keccak256(keccak256(0), keccak256("eth"));
    bytes32 constant public APM_NODE = keccak256(ETH_NODE, keccak256("aragonpm"));
    bytes32 constant public APP_ADDR_NAMESPACE = keccak256("app");

    bytes32 constant public EVMSCRIPT_REGISTRY_APP_ID = apmNameHash("evmreg");
    bytes32 constant public EVMSCRIPT_REGISTRY_APP = keccak256(APP_ADDR_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID);

    function apmNameHash(string name) internal pure returns (bytes32) {
        return keccak256(APM_NODE, keccak256(name));
    }
}


interface IEVMScriptRegistry {
    function addScriptExecutor(address executor) external returns (uint id);
    function disableScriptExecutor(uint256 executorId) external;

    function getScriptExecutor(bytes script) public view returns (address);
}
