pragma solidity 0.4.18;


contract KernelConstants {
    bytes32 constant public CORE_NAMESPACE = keccak256("core");
    bytes32 constant public APP_BASES_NAMESPACE = keccak256("base");
    bytes32 constant public APP_ADDR_NAMESPACE = keccak256("app");

    bytes32 constant public ETH_NODE = keccak256(keccak256(0), keccak256("eth"));
    bytes32 constant public APM_NODE = keccak256(ETH_NODE, keccak256("aragonpm"));

    bytes32 constant public KERNEL_APP_ID = apmNameHash("kernel");
    bytes32 constant public KERNEL_APP = keccak256(CORE_NAMESPACE, KERNEL_APP_ID);

    bytes32 constant public ACL_APP_ID = apmNameHash("acl");
    bytes32 constant public ACL_APP = keccak256(APP_ADDR_NAMESPACE, ACL_APP_ID);

    function apmNameHash(string name) internal pure returns (bytes32) {
        return keccak256(APM_NODE, keccak256(name));
    }
}


contract KernelStorage is KernelConstants {
    mapping (bytes32 => address) public apps;
}
