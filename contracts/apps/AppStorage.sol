pragma solidity 0.4.15;

import "../kernel/Kernel.sol";

contract AppStorage {
    Kernel public kernel;
    bytes32 public appId;
}
