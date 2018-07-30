pragma solidity 0.4.18;

import "../../contracts/lib/misc/TimeHelpers.sol";


contract TimeHelpersMock is TimeHelpers {
    function getBlockNumberExt() public view returns (uint256) {
        return getBlockNumber();
    }

    function getBlockNumber64Ext() public view returns (uint64) {
        return getBlockNumber64();
    }

    function getTimestampExt() public view returns (uint256) {
        return getTimestamp();
    }

    function getTimestamp64Ext() public view returns (uint64) {
        return getTimestamp64();
    }
}
