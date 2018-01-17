pragma solidity ^0.4.18;

import "../kernel/IKernel.sol";


contract AppStorage {
    IKernel public kernel;
    bytes32 public appId;
    address public pin;
    uint256[100] storageOffset; // forces App storage to start at after 100 slots
}
