pragma solidity ^0.4.18;

import "../kernel/IKernel.sol";


contract AppStorage {
    IKernel public kernel;
    bytes32 public appId;
    uint256[97] private storageOffset; // forces App storage to start at after 100 slots
    uint256 private offset;
}
