pragma solidity 0.4.24;

import "../../../common/TimeHelpers.sol";
import "../../../lib/math/SafeMath.sol";
import "../../../lib/math/SafeMath64.sol";


contract TimeHelpersMock is TimeHelpers {
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    uint256 mockedTimestamp;
    uint256 mockedBlockNumber;

    function getBlockNumberDirect() public view returns (uint256) {
        return block.number;
    }

    function getBlockNumberExt() public view returns (uint256) {
        return getBlockNumber();
    }

    function getBlockNumber64Ext() public view returns (uint64) {
        return getBlockNumber64();
    }

    function getTimestampDirect() public view returns (uint256) {
        return now;
    }

    function getTimestampExt() public view returns (uint256) {
        return getTimestamp();
    }

    function getTimestamp64Ext() public view returns (uint64) {
        return getTimestamp64();
    }

    /**
    * @dev Sets a mocked timestamp value, used only for testing purposes
    */
    function mockSetTimestamp(uint256 _timestamp) public {
        mockedTimestamp = _timestamp;
    }

    /**
    * @dev Increases the mocked timestamp value, used only for testing purposes
    */
    function mockIncreaseTime(uint256 _seconds) public {
        if (mockedTimestamp != 0) mockedTimestamp = mockedTimestamp.add(_seconds);
        else mockedTimestamp = block.timestamp.add(_seconds);
    }

    /**
    * @dev Decreases the mocked timestamp value, used only for testing purposes
    */
    function mockDecreaseTime(uint256 _seconds) public {
        if (mockedTimestamp != 0) mockedTimestamp = mockedTimestamp.sub(_seconds);
        else mockedTimestamp = block.timestamp.sub(_seconds);
    }

    /**
    * @dev Advances the mocked block number value, used only for testing purposes
    */
    function mockAdvanceBlocks(uint256 _number) public {
        if (mockedBlockNumber != 0) mockedBlockNumber = mockedBlockNumber.add(_number);
        else mockedBlockNumber = block.number.add(_number);
    }

    /**
    * @dev Returns the mocked timestamp if it was set, or current `block.timestamp`
    */
    function getTimestamp() internal view returns (uint256) {
        if (mockedTimestamp != 0) return mockedTimestamp;
        return super.getTimestamp();
    }

    /**
    * @dev Returns the mocked block number if it was set, or current `block.number`
    */
    function getBlockNumber() internal view returns (uint256) {
        if (mockedBlockNumber != 0) return mockedBlockNumber;
        return super.getBlockNumber();
    }
}
