pragma solidity 0.4.18;

import "../../contracts/lib/misc/Uint64Helpers.sol";


contract Uint64Mock {
    using Uint64Helpers for uint256;

    function convert(uint256 a) public pure returns (uint64) {
        return a.toUint64();
    }
}
