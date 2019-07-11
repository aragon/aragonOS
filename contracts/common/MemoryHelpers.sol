pragma solidity ^0.4.24;


library MemoryHelpers {

    function append(bytes memory self, address addr) internal pure returns (bytes memory) {
        // alloc required encoded data size
        uint256 dataSize = self.length;
        uint256 appendedDataSize = dataSize + 32;
        bytes memory appendedData = new bytes(appendedDataSize);

        // copy data
        uint256 inputPointer;
        uint256 outputPointer;
        assembly {
            inputPointer := add(self, 0x20)
            outputPointer := add(appendedData, 0x20)
        }
        memcpy(outputPointer, inputPointer, dataSize);

        // append address
        assembly {
            let signerPointer := add(add(appendedData, 0x20), dataSize)
            mstore(signerPointer, addr)
        }

        return appendedData;
    }

    // From https://github.com/Arachnid/solidity-stringutils/blob/master/src/strings.sol
    function memcpy(uint256 output, uint256 input, uint256 length) internal pure {
        uint256 len = length;
        uint256 dest = output;
        uint256 src = input;

        // Copy word-length chunks while possible
        for (; len >= 32; len -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint256 mask = 256 ** (32 - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }
}
