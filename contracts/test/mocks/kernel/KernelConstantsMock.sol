pragma solidity 0.4.24;

import "../../../kernel/Kernel.sol";


contract KernelConstantsMock is Kernel {
    constructor() public Kernel(false) { }

    function getKernelCoreNamespace() external pure returns (bytes32) { return KERNEL_CORE_NAMESPACE; }
    function getKernelAppBasesNamespace() external pure returns (bytes32) { return KERNEL_APP_BASES_NAMESPACE; }
    function getKernelAppAddrNamespace() external pure returns (bytes32) { return KERNEL_APP_ADDR_NAMESPACE; }
    function getKernelAppId() external pure returns (bytes32) { return KERNEL_CORE_APP_ID; }
    function getDefaultACLAppId() external pure returns (bytes32) { return KERNEL_DEFAULT_ACL_APP_ID; }
    function getDefaultVaultAppId() external pure returns (bytes32) { return KERNEL_DEFAULT_VAULT_APP_ID; }
}
