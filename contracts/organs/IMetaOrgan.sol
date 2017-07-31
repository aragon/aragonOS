pragma solidity ^0.4.11;

contract MetaEvents {
    event KernelReplaced(address newKernel);
    event PermissionsOracleReplaced(address newPermissionsOracl);
}

contract IMetaOrgan is MetaEvents {
    function ceaseToExist() public;
    function replaceKernel(address newKernel) public;
    function setPermissionsOracle(address newOracle) public;
    function installApp(address appAddress, bytes4[] sigs) public;
    function installOrgan(address organAddress, bytes4[] sigs) public;
    function removeOrgan(bytes4[] sigs) public;
    function removeApp(bytes4[] sigs) public;
}
