pragma solidity 0.4.18;

import "../../contracts/evmscript/EVMScript.sol";


contract Executor is EVMScript, CallsScriptDecoder {
    function execute(bytes script) {
        execScript(script, new address[](0));
    }

    function getActionsCount(bytes script) constant returns (uint256) {
        return getScriptActionsCount(script);
    }

    function getAction(bytes script, uint256 i) constant returns (address, bytes) {
        return getScriptAction(script, i);
    }
}
