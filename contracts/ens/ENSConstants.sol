/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;


contract ENSConstants {
    bytes32 public constant ENS_ROOT = bytes32(0);
    bytes32 public constant ETH_TLD_LABEL = keccak256("eth");
    bytes32 public constant ETH_TLD_NODE = keccak256(abi.encodePacked(ENS_ROOT, ETH_TLD_LABEL));
    bytes32 public constant PUBLIC_RESOLVER_LABEL = keccak256("resolver");
    bytes32 public constant PUBLIC_RESOLVER_NODE = keccak256(abi.encodePacked(ETH_TLD_NODE, PUBLIC_RESOLVER_LABEL));
}
