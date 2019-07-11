pragma solidity 0.4.24;

import "../../../common/TimeHelpers.sol";


contract TimeHelpersMock is TimeHelpers {
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
}
