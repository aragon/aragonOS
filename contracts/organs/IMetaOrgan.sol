pragma solidity ^0.4.11;

contract IMetaOrganEvents {
    event KernelReplaced(address newKernel);
    event PermissionsOracleReplaced(address newPermissionsOracle);
}

contract IMetaOrgan is IMetaOrganEvents {
    function ceaseToExist() external;
    function replaceKernel(address newKernel) external;
    function setPermissionsOracle(address newOracle) external;
    function installApp(address appAddress, bytes4[] sigs) external;
    function installOrgan(address organAddress, bytes4[] sigs) external;
    function removeOrgan(bytes4[] sigs) external;
    function removeApp(bytes4[] sigs) external;
}
