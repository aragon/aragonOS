pragma solidity 0.4.24;

import "../../apps/AragonApp.sol";


contract MockScriptExecutorApp is AragonApp {
    // Initialization is required to access any of the real executors
    function initialize() public {
        initialized();
    }

    function execute(bytes script) public {
        runScript(script, new bytes(0), new address[](0));
    }

    function executeWithBan(bytes script, address[] memory blacklist) public {
        runScript(script, new bytes(0), blacklist);
    }

    function executeWithIO(bytes script, bytes input, address[] memory blacklist) public returns (bytes) {
        return runScript(script, input, blacklist);
    }

    /*
    function getActionsCount(bytes script) public constant returns (uint256) {
        return getScriptActionsCount(script);
    }

    function getAction(bytes script, uint256 i) public constant returns (address, bytes) {
        return getScriptAction(script, i);
    }
    */
}
