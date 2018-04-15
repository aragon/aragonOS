pragma solidity ^0.4.18;


interface IVaultRecoverable {
    function getRecoveryVault() public view returns (address);
    function transferToVault(address _token) external;
}
