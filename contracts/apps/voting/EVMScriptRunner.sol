pragma solidity 0.4.15;

// Inspired by https://github.com/reverendus/tx-manager

contract EVMScriptRunner {
    function runScript(bytes script) internal {
        uint256 location = 0;
        while (location < script.length) {
            address contractAddress = addressAt(script, location);
            uint256 calldataLength = uint256At(script, location + 0x14);
            uint256 calldataStart = locationOf(script, location + 0x14 + 0x20);
            uint8 ok;
            assembly {
                ok := call(sub(gas, 5000), contractAddress, 0, calldataStart, calldataLength, 0, 0)
            }
            if (ok == 0) revert();

            location += (0x14 + 0x20 + calldataLength);
        }
    }

    function makeSingleScript(address to, bytes calldata) constant returns (bytes script) {
        uint l = 20 + 32 + calldata.length;

        uint srcPointer; uint dstPointer;
        assembly {
            script := mload(0x40)
            mstore(0x40, add(script, add(l, 0x20)))
            mstore(add(script, 0x14), to)
            mstore(script, l)
            srcPointer := calldata
            dstPointer := add(script, add(0x20, 0x14))
        }

        memcpy(dstPointer, srcPointer, 32 + calldata.length);
    }

    function getScriptActionsCount(bytes script) internal constant returns (uint256 i) {
        uint256 location = 0;
        while (location < script.length) {
            location += (0x14 + 0x20 + uint256At(script, location + 0x14));
            i++;
        }
    }

    function getScriptAction(bytes script, uint256 i) internal constant returns (address, bytes) {
        uint256 location = 0;
        while (location < script.length) {
            if (i == 0) {
                bytes memory calldata;
                uint256 calldataPtr = locationOf(script, location + 0x14);
                assembly { calldata := calldataPtr }
                return (addressAt(script, location), calldata);
            }

            location += (0x14 + 0x20 + uint256At(script, location + 0x14));
            i--;
        }
    }

    function uint256At(bytes data, uint256 location) private returns (uint256 result) {
        assembly {
            result := mload(add(data, add(0x20, location)))
        }
    }

    function addressAt(bytes data, uint256 location) private returns (address result) {
        uint256 word = uint256At(data, location);

        assembly {
            result := div(and(word, 0xffffffffffffffffffffffffffffffffffffffff000000000000000000000000),
                          0x1000000000000000000000000)
        }
    }

    function locationOf(bytes data, uint256 location) private returns (uint256 result) {
        assembly {
            result := add(data, add(0x20, location))
        }
    }

    // From https://github.com/Arachnid/solidity-stringutils
    function memcpy(uint dest, uint src, uint len) private {
        // Copy word-length chunks while possible
        for(; len >= 32; len -= 32) {
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
