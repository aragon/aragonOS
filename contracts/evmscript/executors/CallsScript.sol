pragma solidity 0.4.18;

// Inspired by https://github.com/reverendus/tx-manager

import "../ScriptHelpers.sol";
import "../IEVMScriptExecutor.sol";


contract CallsScript is IEVMScriptExecutor {
    using ScriptHelpers for bytes;

    // bytes32 constant internal EXECUTOR_TYPE = keccak256("CALLS_SCRIPT");
    bytes32 constant internal EXECUTOR_TYPE = 0x2dc858a00f3e417be1394b87c07158e989ec681ce8cc68a9093680ac1a870302;

    uint256 constant internal SCRIPT_START_LOCATION = 4;

    event LogScriptCall(address indexed sender, address indexed src, address indexed dst);

    /**
    * @notice Executes a number of call scripts
    * @param _script [ specId (uint32) ] many calls with this structure ->
    *    [ to (address: 20 bytes) ] [ calldataLength (uint32: 4 bytes) ] [ calldata (calldataLength bytes) ]
    * @param _input Input is ignored in callscript
    * @param _blacklist Addresses the script cannot call to, or will revert.
    * @return always returns empty byte array
    */
    function execScript(bytes _script, bytes _input, address[] _blacklist) external returns (bytes) {
        uint256 location = SCRIPT_START_LOCATION; // first 32 bits are spec id
        while (location < _script.length) {
            address contractAddress = _script.addressAt(location);
            // Check address being called is not blacklist
            for (uint i = 0; i < _blacklist.length; i++) {
                require(contractAddress != _blacklist[i]);
            }

            // logged before execution to ensure event ordering in receipt
            // if failed entire execution is reverted regardless
            LogScriptCall(msg.sender, address(this), contractAddress);

            uint256 calldataLength = uint256(_script.uint32At(location + 0x14));
            uint256 startOffset = location + 0x14 + 0x04;
            uint256 calldataStart = _script.locationOf(startOffset);

            // compute end of script / next location
            location = startOffset + calldataLength;
            require(location <= _script.length);

            assembly {
                let success := call(sub(gas, 5000), contractAddress, 0, calldataStart, calldataLength, 0, 0)
                switch success case 0 { revert(0, 0) }
            }
        }
    }

    function executorType() external pure returns (bytes32) {
        return EXECUTOR_TYPE;
    }
}
