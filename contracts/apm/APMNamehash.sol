/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "../ens/ENSConstants.sol";


contract APMNamehash is ENSConstants {
    bytes32 public constant APM_NODE = keccak256(abi.encodePacked(ETH_TLD_NODE, keccak256("aragonpm")));

    function apmNamehash(string name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(APM_NODE, keccak256(bytes(name))));
    }
}
