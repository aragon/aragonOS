pragma solidity ^0.4.18;


contract ENSConstants {
    bytes32 constant public ENS_ROOT = bytes32(0);
    bytes32 constant public ETH_TLD_LABEL = keccak256("eth");
    bytes32 constant public ETH_TLD_NODE = keccak256(ENS_ROOT, ETH_TLD_LABEL);
    bytes32 constant public PUBLIC_RESOLVER_LABEL = keccak256("resolver");
    bytes32 constant public PUBLIC_RESOLVER_NODE = keccak256(ETH_TLD_NODE, PUBLIC_RESOLVER_LABEL);
}
