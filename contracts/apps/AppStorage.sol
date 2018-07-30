/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "../common/UnstructuredStorage.sol";


contract AppStorage is UnstructuredStorage {
    bytes32 public constant kernelPosition = keccak256("IKernel.kernel");
    bytes32 public constant appIdPosition = keccak256("bytes32.appIdPosition");
    bytes32 internal constant pinnedCodePosition = keccak256("address.pinnedCode"); // used by Proxy Pinned
    bytes32 internal constant initializationBlockPosition = keccak256("uint256.initializationBlock"); // used by Initializable
}
