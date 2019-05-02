pragma solidity 0.4.24;

import "../../../common/Uint256Helpers.sol";


contract Uint256Mock {
    using Uint256Helpers for uint256;

    function convert(uint256 a) public pure returns (uint64) {
        return a.toUint64();
    }
}
