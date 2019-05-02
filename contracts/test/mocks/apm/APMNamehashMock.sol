pragma solidity 0.4.24;

import "../../../apm/APMNamehash.sol";


contract APMNamehashMock is APMNamehash {
    function getAPMNode() external pure returns (bytes32) { return APM_NODE; }

    function getAPMNamehash(string name) external pure returns (bytes32) {
        return apmNamehash(name);
    }
}
