pragma solidity 0.4.18;

import "../ScriptHelpers.sol";
import "../../common/DelegateProxy.sol";


interface DelegateScriptTarget {
    function exec() public;
}


contract DelegateScript is DelegateProxy {
    using ScriptHelpers for *;

    uint32 constant SPEC_ID = 2;
    uint256 constant public START_LOCATION = 4;

    /**
    * @notice Executes script by delegatecall into a contract
    */
    function execScript(bytes script) internal {
        // Script should be spec id + address (20 bytes)
        require(script.length == START_LOCATION + 20);
        delegate(script.addressAt(START_LOCATION));
    }

    function delegate(address addr) internal {
        bytes4 execSig = DelegateScriptTarget(0).exec.selector;
        bytes memory execData = execSig.toBytes();

        delegatedFwd(addr, execData);
    }
}
