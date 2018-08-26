pragma solidity 0.4.24;

import "../../apm/APMNamehash.sol";


contract APMNamehashWrapper is APMNamehash {
    function getAPMNamehash(string name) public view returns (bytes32 hash) {
        hash = apmNamehash(name);
        return hash;
    }
}
