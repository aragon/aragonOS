pragma solidity ^0.4.18;

import "../../contracts/apm/APMConstants.sol";


contract APMNamehash is APMConstants {
    function apmNamehash(string name) internal pure returns (bytes32) {
        return keccak256(APM_NODE, keccak256(name));
    }
}
