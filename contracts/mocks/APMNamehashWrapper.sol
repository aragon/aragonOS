pragma solidity 0.4.24;

import "../apm/APMNamehash.sol";


contract APMNamehashWrapper is APMNamehash {
    event LogHash(string name, bytes32 hash);

    function getAPMNamehash(string name) public returns (bytes32 hash) {
        hash = apmNamehash(name);
        emit LogHash("eth node", ETH_TLD_NODE);
        emit LogHash("aragonpm.eth", APM_NODE);
        emit LogHash(name, hash);
        return hash;
    }
}
