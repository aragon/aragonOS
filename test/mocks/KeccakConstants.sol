pragma solidity 0.4.18;

import "./APMNamehash.sol";


contract KeccakConstants is APMNamehash {
    // Kernel
    bytes32 constant public CORE_NAMESPACE = keccak256("core");
    bytes32 constant public APP_BASES_NAMESPACE = keccak256("base");
    bytes32 constant public APP_ADDR_NAMESPACE = keccak256("app");

    bytes32 constant public KERNEL_APP_ID = apmNamehash("kernel");
    bytes32 constant public KERNEL_APP = keccak256(CORE_NAMESPACE, KERNEL_APP_ID);

    bytes32 constant public ACL_APP_ID = apmNamehash("acl");
    bytes32 constant public ACL_APP = keccak256(APP_ADDR_NAMESPACE, ACL_APP_ID);

    bytes32 constant public APP_MANAGER_ROLE = keccak256("APP_MANAGER_ROLE");

    bytes32 constant public DEFAULT_VAULT_ID = keccak256(APP_ADDR_NAMESPACE, apmNamehash("vault"));

    // ENS
    bytes32 constant public ENS_ROOT = bytes32(0);
    bytes32 constant public ETH_TLD_LABEL = keccak256("eth");
    bytes32 constant public ETH_TLD_NODE = keccak256(ENS_ROOT, ETH_TLD_LABEL);
    bytes32 constant public PUBLIC_RESOLVER_LABEL = keccak256("resolver");
    bytes32 constant public PUBLIC_RESOLVER_NODE = keccak256(ETH_TLD_NODE, PUBLIC_RESOLVER_LABEL);

    // ACL
    bytes32 constant public CREATE_PERMISSIONS_ROLE = keccak256("CREATE_PERMISSIONS_ROLE");
    bytes32 constant public EMPTY_PARAM_HASH = keccak256(uint256(0));

    // APMRegistry
    bytes32 constant public CREATE_REPO_ROLE = keccak256("CREATE_REPO_ROLE");

    // ENSSubdomainRegistrar
    bytes32 constant public CREATE_NAME_ROLE = keccak256("CREATE_NAME_ROLE");
    bytes32 constant public DELETE_NAME_ROLE = keccak256("DELETE_NAME_ROLE");
    bytes32 constant public POINT_ROOTNODE_ROLE = keccak256("POINT_ROOTNODE_ROLE");

    // EVMScriptRegistry
    bytes32 constant public EVMSCRIPT_REGISTRY_APP_ID = apmNamehash("evmreg");
    bytes32 constant public EVMSCRIPT_REGISTRY_APP = keccak256(APP_ADDR_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID);
    bytes32 constant public REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");

    // Repo
    bytes32 constant public CREATE_VERSION_ROLE = keccak256("CREATE_VERSION_ROLE");
}
