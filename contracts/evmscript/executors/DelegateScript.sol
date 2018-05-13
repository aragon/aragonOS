pragma solidity 0.4.18;

import "../ScriptHelpers.sol";
import "../IEVMScriptExecutor.sol";
import "../../common/IsContract.sol";


interface DelegateScriptTarget {
    function exec() public returns (bool);
}


contract DelegateScript is IEVMScriptExecutor, IsContract {
    using ScriptHelpers for *;

    uint256 constant internal SCRIPT_START_LOCATION = 4;

    /**
    * @notice Executes script by delegatecall into a contract
    * @param _script [ specId (uint32) ][ contract address (20 bytes) ]
    * @param _input ABI encoded call to be made to contract (if empty executes default exec() function)
    * @param _blacklist If any address is passed, will revert.
    * @return Call return data
    */
    function execScript(bytes _script, bytes _input, address[] _blacklist) external returns (bytes) {
        require(_blacklist.length == 0); // dont have ability to control bans, so fail.

        // Script should be spec id + address (20 bytes)
        require(_script.length == SCRIPT_START_LOCATION + 20);
        return delegate(_script.addressAt(SCRIPT_START_LOCATION), _input);
    }

    /**
    * @dev Delegatecall to contract with input data
    */
    function delegate(address _addr, bytes memory _input) internal returns (bytes memory output) {
        require(isContract(_addr));
        require(_addr.delegatecall(_input.length > 0 ? _input : defaultInput()));
        bytes memory ret = returnedData();

        require(ret.length > 0);

        return ret;
    }

    function defaultInput() internal pure returns (bytes) {
        return DelegateScriptTarget(0).exec.selector.toBytes();
    }

    /**
    * @dev copies and returns last's call data
    */
    function returnedData() internal pure returns (bytes ret) {
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
