pragma solidity 0.4.18;

import "../../contracts/evmscript/EVMScript.sol";
import "../../contracts/apps/AppStorage.sol";

contract ExecutorStorage is AppStorage {
    uint256 public randomNumber;
}

contract Executor is ExecutorStorage, EVMScript, CallsScriptDecoder {
    function Executor() {
        kernel = IKernel(0);
        appId = bytes32(0);
    }

    function execute(bytes script) {
        execScript(script, new address[](0));
    }

    function executeWithBan(bytes script, address[] memory banned) {
        execScript(script, banned);
    }

    function getActionsCount(bytes script) constant returns (uint256) {
        return getScriptActionsCount(script);
    }

    function getAction(bytes script, uint256 i) constant returns (address, bytes) {
        return getScriptAction(script, i);
    }
}
