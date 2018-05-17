pragma solidity 0.4.18;

import "../../contracts/apm/APMNamehash.sol";


contract APMNamehashWrapper is APMNamehash {
    event LogHash(string name, bytes32 hash);

    function getAPMNamehash(string name) public returns (bytes32 hash) {
        hash = apmNamehash(name);
        LogHash("eth node", ETH_TLD_NODE);
        LogHash("aragonpm.eth", APM_NODE);
        LogHash(name, hash);
        return hash;
    }
}
