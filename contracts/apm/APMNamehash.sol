pragma solidity ^0.4.18;

import "../ens/ENSConstants.sol";


contract APMNamehash is ENSConstants {
    bytes32 constant public APM_NODE = keccak256(ETH_TLD_NODE, keccak256("aragonpm"));

    function apmNamehash(string name) internal pure returns (bytes32) {
        return keccak256(APM_NODE, keccak256(name));
    }
}
