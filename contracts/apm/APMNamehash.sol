pragma solidity 0.4.18;


contract APMNamehash {
    bytes32 constant public ETH_NODE = keccak256(bytes32(0), keccak256("eth"));
    bytes32 constant public APM_NODE = keccak256(ETH_NODE, keccak256("aragonpm"));

    function apmNamehash(string name) internal pure returns (bytes32) {
        return keccak256(APM_NODE, keccak256(name));
    }
}
