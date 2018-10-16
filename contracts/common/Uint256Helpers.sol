pragma solidity ^0.4.24;


library Uint256Helpers {
    uint256 public constant MAX_UINT64 = uint64(-1);

    string private constant NUMBER_TOO_BIG_ERROR = "UINT64_NUMBER_TOO_BIG";

    function toUint64(uint256 a) internal pure returns (uint64) {
        require(a <= MAX_UINT64, NUMBER_TOO_BIG_ERROR);
        return uint64(a);
    }
}
