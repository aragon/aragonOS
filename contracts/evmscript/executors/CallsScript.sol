pragma solidity ^0.4.18;

// Inspired by https://github.com/reverendus/tx-manager

import "../ScriptHelpers.sol";
import "../IEVMScriptExecutor.sol";


contract CallsScript is IEVMScriptExecutor {
    using ScriptHelpers for bytes;

    uint256 constant internal SCRIPT_START_LOCATION = 4;

    event LogScriptCall(address indexed sender, address indexed src, address indexed dst);

    /**
    * @notice Executes script by delegatecall into a contract
    * @param script [ specId (uint32) ] many calls with this structure ->
    *    [ to (address: 20 bytes) ] [ calldataLength (uint32: 4 bytes) ] [ calldata (calldataLength bytes) ]
    * @param input Input is ignored in callscript
    * @param blacklist Addresses the script cannot call to, or will revert.
    * @return always returns empty byte array
    */
    function execScript(bytes script, bytes input, address[] blacklist) external returns (bytes) {
        uint256 location = SCRIPT_START_LOCATION; // first 32 bits are spec id
        while (location < script.length) {
            address contractAddress = script.addressAt(location);
            // Check address being called is not blacklist
            for (uint i = 0; i < blacklist.length; i++) {
                require(contractAddress != blacklist[i]);
            }

            // logged before execution to ensure event ordering in receipt
            // if failed entire execution is reverted regardless
            LogScriptCall(msg.sender, address(this), contractAddress);

            uint256 calldataLength = uint256(script.uint32At(location + 0x14));
            uint256 calldataStart = script.locationOf(location + 0x14 + 0x04);

            assembly {
                let success := call(sub(gas, 5000), contractAddress, 0, calldataStart, calldataLength, 0, 0)
                switch success case 0 { revert(0, 0) }
            }

            location += (0x14 + 0x04 + calldataLength);
        }
    }
}
