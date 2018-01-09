pragma solidity ^0.4.18;

import "../kernel/IKernel.sol";


contract AppStorage {
    IKernel public kernel;
    bytes32 public appId;
}
