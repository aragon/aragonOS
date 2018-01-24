pragma solidity 0.4.18;

import "../../contracts/apps/AragonApp.sol";


contract ExecutorStorage is AragonApp {
    uint256 public randomNumber;
}

// TODO: Rename
contract Executor is ExecutorStorage {
    function execute(bytes script) {
        runScript(script, new bytes(0), new address[](0));
    }

    function executeWithBan(bytes script, address[] memory blacklist) {
        runScript(script, new bytes(0), blacklist);
    }

    function executeWithIO(bytes script, bytes input, address[] memory blacklist) returns (bytes) {
        return runScript(script, input, blacklist);
    }

    /*
    function getActionsCount(bytes script) constant returns (uint256) {
        return getScriptActionsCount(script);
    }

    function getAction(bytes script, uint256 i) constant returns (address, bytes) {
        return getScriptAction(script, i);
    }
    */
}
