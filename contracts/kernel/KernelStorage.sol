pragma solidity 0.4.24;

import "./KernelConstants.sol";


contract KernelStorage is KernelConstants, KernelNamespaceConstants {
    // namespace => app id => address
    mapping (bytes32 => mapping (bytes32 => address)) public apps;
    bytes32 public recoveryVaultAppId;
}
