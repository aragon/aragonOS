pragma solidity 0.4.24;

import "./KernelConstants.sol";


contract KernelStorage is KernelConstants {
    mapping (bytes32 => mapping (bytes32 => address)) public apps;
    bytes32 public recoveryVaultAppId;
}
