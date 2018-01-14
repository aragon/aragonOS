pragma solidity 0.4.18;

import "../../contracts/common/EVMCallScript.sol";

contract Executor is EVMCallScriptRunner, EVMCallScriptDecoder {
    function execute(bytes script) {
        runScript(script);
    }

    function getActionsCount(bytes script) constant returns (uint256) {
        return getScriptActionsCount(script);
    }

    function getAction(bytes script, uint256 i) constant returns (address, bytes) {
        return getScriptAction(script, i);
    }
}
