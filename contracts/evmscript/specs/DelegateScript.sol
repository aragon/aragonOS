pragma solidity 0.4.18;

import "../ScriptHelpers.sol";


interface DelegateScriptTarget {
    function exec() public;
}


contract DelegateScript {
    using ScriptHelpers for *;

    uint32 constant SPEC_ID = 2;
    uint256 constant public START_LOCATION = 4;

    /**
    * @notice Executes script by delegatecall into a contract
    * @param script [ specId (uint32 = 2) ][ contract address (20 bytes) ]
    * @param banned If any address is passed, will revert.
    * @dev Selfdestruct contract at the end of execution to get gas refund
    */
    function execScript(bytes memory script, address[] memory banned) internal {
        require(banned.length == 0); // dont have ability to control bans, so fail.

        // Script should be spec id + address (20 bytes)
        require(script.length == START_LOCATION + 20);
        delegate(script.addressAt(START_LOCATION));
    }

    function delegate(address addr) internal {
        require(isContract(addr));
        require(addr.delegatecall(DelegateScriptTarget(0).exec.selector));
    }

    function isContract(address _target) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(_target) }
        return size > 0;
    }
}
