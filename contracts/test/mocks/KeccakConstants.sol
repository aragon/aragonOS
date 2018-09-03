pragma solidity 0.4.24;

import "../../apm/APMNamehash.sol";


contract KeccakConstants is APMNamehash {
    // Note: we can't use APMNamehash.apmNamehash() for constants, starting from pragma 0.5 :(

    // Kernel
    bytes32 constant public CORE_NAMESPACE = keccak256(abi.encodePacked("core"));
    bytes32 constant public APP_BASES_NAMESPACE = keccak256(abi.encodePacked("base"));
    bytes32 constant public APP_ADDR_NAMESPACE = keccak256(abi.encodePacked("app"));

    bytes32 constant public KERNEL_APP_ID = keccak256(abi.encodePacked(APM_NODE, keccak256("kernel")));
    bytes32 constant public ACL_APP_ID = keccak256(abi.encodePacked(APM_NODE, keccak256("acl")));

    bytes32 constant public APP_MANAGER_ROLE = keccak256(abi.encodePacked("APP_MANAGER_ROLE"));

    bytes32 constant public DEFAULT_VAULT_APP_ID = keccak256(abi.encodePacked(APM_NODE, keccak256("vault")));

    // ENS
    bytes32 constant public ENS_ROOT = bytes32(0);
    bytes32 constant public ETH_TLD_LABEL = keccak256(abi.encodePacked("eth"));
    bytes32 constant public ETH_TLD_NODE = keccak256(abi.encodePacked(ENS_ROOT, ETH_TLD_LABEL));
    bytes32 constant public PUBLIC_RESOLVER_LABEL = keccak256(abi.encodePacked("resolver"));
    bytes32 constant public PUBLIC_RESOLVER_NODE = keccak256(abi.encodePacked(ETH_TLD_NODE, PUBLIC_RESOLVER_LABEL));

    // ACL
    bytes32 constant public CREATE_PERMISSIONS_ROLE = keccak256(abi.encodePacked("CREATE_PERMISSIONS_ROLE"));
    bytes32 constant public EMPTY_PARAM_HASH = keccak256(abi.encodePacked(uint256(0)));

    // APMRegistry
    bytes32 constant public CREATE_REPO_ROLE = keccak256(abi.encodePacked("CREATE_REPO_ROLE"));

    // ENSSubdomainRegistrar
    bytes32 constant public CREATE_NAME_ROLE = keccak256(abi.encodePacked("CREATE_NAME_ROLE"));
    bytes32 constant public DELETE_NAME_ROLE = keccak256(abi.encodePacked("DELETE_NAME_ROLE"));
    bytes32 constant public POINT_ROOTNODE_ROLE = keccak256(abi.encodePacked("POINT_ROOTNODE_ROLE"));

    // EVMScriptRegistry
    bytes32 constant public EVMSCRIPT_REGISTRY_APP_ID = keccak256(abi.encodePacked(APM_NODE, keccak256("evmreg")));
    bytes32 constant public REGISTRY_ADD_EXECUTOR_ROLE = keccak256("REGISTRY_ADD_EXECUTOR_ROLE");
    bytes32 constant public REGISTRY_MANAGER_ROLE = keccak256(abi.encodePacked("REGISTRY_MANAGER_ROLE"));

    // EVMScriptExecutor types
    bytes32 constant public EVMSCRIPT_EXECUTOR_CALLS_SCRIPT = keccak256(abi.encodePacked("CALLS_SCRIPT"));

    // Repo
    bytes32 constant public CREATE_VERSION_ROLE = keccak256(abi.encodePacked("CREATE_VERSION_ROLE"));

    // Unstructured storage
    bytes32 public constant initializationBlockPosition = keccak256(abi.encodePacked("aragonOS.initializable.initializationBlock"));
    bytes32 public constant depositablePosition = keccak256(abi.encodePacked("aragonOS.depositableStorage.depositable"));
    bytes32 public constant kernelPosition = keccak256(abi.encodePacked("aragonOS.appStorage.kernel"));
    bytes32 public constant appIdPosition = keccak256(abi.encodePacked("aragonOS.appStorage.appId"));
    bytes32 public constant pinnedCodePosition = keccak256(abi.encodePacked("aragonOS.appStorage.pinnedCode"));
}
