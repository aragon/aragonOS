pragma solidity ^0.4.11;

import "../organs/IVaultOrgan.sol";
import "../organs/IMetaOrgan.sol";
import "../kernel/IKernelRegistry.sol";

contract DAOEvents is IKernelRegistryEvents, IMetaOrganEvents, IVaultOrganEvents {}
