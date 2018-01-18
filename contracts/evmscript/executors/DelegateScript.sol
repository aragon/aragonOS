pragma solidity 0.4.18;

import "../ScriptHelpers.sol";
import "../IEVMScriptExecutor.sol";


interface DelegateScriptTarget {
    function exec() public;
}


contract DelegateScript is IEVMScriptExecutor {
    using ScriptHelpers for *;

    uint256 constant internal SCRIPT_START_LOCATION = 4;
    
    /**
    * @notice Executes script by delegatecall into a contract
    * @param script [ specId (uint32 = 2) ][ contract address (20 bytes) ]
    * @param input ABI encoded call to be made to contract (if empty executes default exec() function)
    * @param blacklist If any address is passed, will revert.
    * @return Call return data
    */
    function execScript(bytes script, bytes input, address[] blacklist) external returns (bytes) {
        require(blacklist.length == 0); // dont have ability to control bans, so fail.

        // Script should be spec id + address (20 bytes)
        require(script.length == SCRIPT_START_LOCATION + 20);
        return delegate(script.addressAt(SCRIPT_START_LOCATION), input);
    }

    function getScriptActionsCount(bytes script) public pure returns (uint256) {
        return 1;
    }

    function getScriptAction(bytes script, uint256 position) public pure returns (address, bytes) {
        return (script.addressAt(SCRIPT_START_LOCATION), new bytes(0));
    }

    /**
    * @dev Delegatecall to contract with input data
    */
    function delegate(address addr, bytes memory input) internal returns (bytes memory output) {
        require(isContract(addr));
        require(addr.delegatecall(input.length > 0 ? input : defaultInput()));
        return returnedData();
    }

    function isContract(address _target) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(_target) }
        return size > 0;
    }

    function defaultInput() internal pure returns (bytes) {
        return DelegateScriptTarget(0).exec.selector.toBytes();
    }

    /**
    * @dev copies and returns last's call data
    */
    function returnedData() internal view returns (bytes ret) {
        assembly {
            let size := returndatasize
            ret := mload(0x40) // free mem ptr get
            mstore(0x40, add(ret, add(size, 0x20))) // free mem ptr set
            mstore(ret, size) // set array length
            returndatacopy(add(ret, 0x20), 0, size) // copy return data
        }
        return ret;
    }
}
