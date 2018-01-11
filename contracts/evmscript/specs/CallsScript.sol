pragma solidity ^0.4.18;

// Inspired by https://github.com/reverendus/tx-manager

import "../ScriptHelpers.sol";


contract CallsScript {
    using ScriptHelpers for bytes;

    uint32 constant SPEC_ID = 1;
    uint256 constant public START_LOCATION = 4;

    event LogScriptCall(address indexed sender, address indexed src, address indexed dst);

    /**
    * @notice Executes script by delegatecall into a contract
    * @param script [ specId (uint32 = 1) ] many calls with this structure ->
    *    [ to (address: 20 bytes) ] [ calldataLength (uint32: 4 bytes) ] [ calldata (calldataLength bytes) ]
    * @param banned Addresses the script cannot call to, or will revert.
    */
    function execScript(bytes memory script, address[] memory banned) internal {
        uint256 location = START_LOCATION; // first 32 bits are spec id
        while (location < script.length) {
            address contractAddress = script.addressAt(location);
            // Check address being called is not banned
            for (uint i = 0; i < banned.length; i++) {
                require(contractAddress != banned[i]);
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


contract CallsScriptDecoder is CallsScript {
    using ScriptHelpers for bytes;

    function getScriptActionsCount(bytes memory script) internal pure returns (uint256 i) {
        uint256 location = START_LOCATION;
        while (location < script.length) {
            location += (0x14 + 0x04 + uint256(script.uint32At(location + 0x14)));
            i++;
        }
    }

    function getScriptAction(bytes memory script, uint256 position) internal pure returns (address, bytes) {
        uint256 location = START_LOCATION;
        uint i = position;
        while (location < script.length) {
            if (i == 0) {
                uint256 length = uint256(script.uint32At(location + 0x14));
                address addr = script.addressAt(location);
                bytes memory calldata = new bytes(length);
                uint calldataPtr;
                assembly { calldataPtr := add(calldata, 0x20) }
                memcpy(calldataPtr, script.locationOf(location + 0x14 + 0x04), length);
                return (addr, calldata);
            }

            location += (0x14 + 0x04 + uint256(script.uint32At(location + 0x14)));
            i--;
        }
    }

    // From https://github.com/Arachnid/solidity-stringutils
    // WARNING: HAS SIDE EFFECTS IN MEMORY
    function memcpy(uint _dest, uint _src, uint _len) pure private {
        uint256 src = _src;
        uint256 dest = _dest;
        uint256 len = _len;

        // Copy word-length chunks while possible
        for (; len >= 32; len -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }
}
