/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "../common/UnstructuredStorage.sol";


contract AppStorage is UnstructuredStorage {
    // keccak256("IKernel.kernel")
    bytes32 public constant kernelPosition = 0xe30296d9191ef86f01c8532636453e486db506a7be081a32b88c263fbc3a5e15;
    // keccak256("bytes32.appIdPosition")
    bytes32 public constant appIdPosition = 0x71ca50ba614d1d1a9a2433a5d0187a13e1a8c20bbe0013968dd089c71fd760eb;
    // keccak256("address.pinnedCode"), used by Proxy Pinned
    bytes32 public constant pinnedCodePosition = 0x0e2081dcdbb92be1037e55b39e913e70697c33a8a8b9bb01110e6f9e576089b8;
}
