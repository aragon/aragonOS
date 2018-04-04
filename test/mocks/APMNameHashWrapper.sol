pragma solidity 0.4.18;

import "../../contracts/apm/APMNameHash.sol";


contract APMNameHashWrapper is APMNameHash {
    event LogHash(string name, bytes32 hash);

    function getAPMNameHash(string name) public returns (bytes32 hash) {
        hash = apmNameHash(name);
        LogHash("eth node", ETH_NODE);
        LogHash("aragonpm.eth", APM_NODE);
        LogHash(name, hash);
        return hash;
    }
}
