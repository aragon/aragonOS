pragma solidity 0.4.24;


contract KernelStorage {
    mapping (bytes32 => mapping (bytes32 => address)) public apps;
    bytes32 public recoveryVaultAppId;
}
