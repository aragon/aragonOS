pragma solidity 0.4.24;

import "../helpers/Assert.sol";
import "../../common/MemoryHelpers.sol";


contract TestMemoryHelpers {
    using MemoryHelpers for bytes;

    uint256 constant internal FIRST = uint256(10);
    uint256 constant internal SECOND = uint256(1);
    uint256 constant internal THIRD = uint256(15);

    function testBytesArrayCopy() public {
        bytes memory blob = _initializeArbitraryBytesArray();
        uint256 blobSize = blob.length;
        bytes memory copy = new bytes(blobSize);
        uint256 input;
        uint256 output;
        assembly {
            input := add(blob, 0x20)
            output := add(copy, 0x20)
        }
        MemoryHelpers.memcpy(output, input, blobSize);

        Assert.equal(blob.length, copy.length, "should have correct length");

        uint256 firstWord = _assertEqualMemoryWord(blob, copy, 0);
        Assert.equal(firstWord, FIRST, "first value should match");

        uint256 secondWord = _assertEqualMemoryWord(blob, copy, 1);
        Assert.equal(secondWord, SECOND, "second value should match");

        uint256 thirdWord = _assertEqualMemoryWord(blob, copy, 2);
        Assert.equal(thirdWord, THIRD, "third value should match");
    }

    function testAppendAddressToBytesArray() public {
        bytes memory blob = _initializeArbitraryBytesArray();
        address addr = address(0x000000000000000000000000000000000000dEaD);
        bytes memory result = blob.append(addr);

        Assert.equal(blob.length + 32, result.length, "should have correct length");

        uint256 firstWord = _assertEqualMemoryWord(blob, result, 0);
        Assert.equal(firstWord, FIRST, "first value should match");

        uint256 secondWord = _assertEqualMemoryWord(blob, result, 1);
        Assert.equal(secondWord, SECOND, "second value should match");

        uint256 thirdWord = _assertEqualMemoryWord(blob, result, 2);
        Assert.equal(thirdWord, THIRD, "third value should match");

        bytes32 storedAddress;
        assembly { storedAddress := mload(add(result, 0x80))}
        Assert.equal(storedAddress, bytes32(0x000000000000000000000000000000000000000000000000000000000000dEaD), "appended address should match");
    }

    function _assertEqualMemoryWord(bytes _actual, bytes _expected, uint256 _index) private returns (uint256) {
        uint256 actualValue;
        uint256 expectedValue;
        uint256 pos = _index * 32;
        assembly {
            actualValue := mload(add(add(_actual, 0x20), pos))
            expectedValue := mload(add(add(_expected, 0x20), pos))
        }
        Assert.equal(actualValue, expectedValue, "memory values should match");
        return expectedValue;
    }

    function _initializeArbitraryBytesArray() private pure returns (bytes memory) {
        bytes memory blob = new bytes(96);

        uint256 first = FIRST;
        uint256 second = SECOND;
        uint256 third = THIRD;
        assembly {
            mstore(add(blob, 0x20), first)
            mstore(add(blob, 0x40), second)
            mstore(add(blob, 0x60), third)
        }

        return blob;
    }
}
