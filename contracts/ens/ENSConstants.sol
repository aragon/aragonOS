pragma solidity ^0.4.18;


contract ENSConstants {
    bytes32 constant public ENS_ROOT = bytes32(0);
    /* Constants are hardcoded to save gas
    bytes32 constant public ETH_TLD_LABEL = keccak256("eth");
    bytes32 constant public ETH_TLD_NODE = keccak256(ENS_ROOT, ETH_TLD_LABEL);
    bytes32 constant public PUBLIC_RESOLVER_LABEL = keccak256("resolver");
    bytes32 constant public PUBLIC_RESOLVER_NODE = keccak256(ETH_TLD_NODE, PUBLIC_RESOLVER_LABEL);
    */
    bytes32 constant public ETH_TLD_LABEL = 0x4f5b812789fc606be1b3b16908db13fc7a9adf7ca72641f84d75b47069d3d7f0;
    bytes32 constant public ETH_TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    bytes32 constant public PUBLIC_RESOLVER_LABEL = 0x329539a1d23af1810c48a07fe7fc66a3b34fbc8b37e9b3cdb97bb88ceab7e4bf;
    bytes32 constant public PUBLIC_RESOLVER_NODE = 0xfdd5d5de6dd63db72bbc2d487944ba13bf775b50a80805fe6fcaba9b0fba88f5;
}
