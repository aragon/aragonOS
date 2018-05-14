pragma solidity ^0.4.18;

import "../ens/ENSConstants.sol";


contract APMConstants is ENSConstants {
    bytes32 constant public APM_NODE = keccak256(ETH_TLD_NODE, keccak256("aragonpm"));
}
