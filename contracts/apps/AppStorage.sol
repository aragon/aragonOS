pragma solidity ^0.4.18;

import "../kernel/IKernel.sol";


contract AppStorage {
    IKernel public kernel;
    bytes32 public appId;
    address internal pinnedCode; // used by Proxy Pinned
    uint256 internal initializationBlock; // used by Initializable
    uint256[95] private storageOffset; // forces App storage to start at after 100 slots
    uint256 private offset;
}
