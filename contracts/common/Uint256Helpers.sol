pragma solidity ^0.4.24;


library Uint256Helpers {
    uint256 public constant MAX_UINT64 = uint64(-1);

    function toUint64(uint256 a) internal pure returns (uint64) {
        require(a <= MAX_UINT64);
        return uint64(a);
    }
}
