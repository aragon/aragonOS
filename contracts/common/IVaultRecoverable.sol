pragma solidity ^0.4.18;


interface IVaultRecoverable {
    function transferToVault(address token) external;

    function allowRecoverability(address token) public view returns (bool);
    function getRecoveryVault() public view returns (address);
}
