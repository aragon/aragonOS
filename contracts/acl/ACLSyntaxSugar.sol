pragma solidity 0.4.18;


contract ACLSyntaxSugar {
    function arr() internal view returns (uint256[] r) {}

    function arr(uint256 a) internal view returns (uint256[] r) {
        r = new uint256[](1);
        r[0] = a;
    }

    function arr(bytes32 a) internal view returns (uint256[] r) {
        return arr(uint256(a));
    }

    function arr(bytes32 a, bytes32 b) internal view returns (uint256[] r) {
        return arr(uint256(a), uint256(b));
    }

    function arr(address a) internal view returns (uint256[] r) {
        return arr(uint256(a));
    }

    function arr(uint256 a, uint256 b) internal view returns (uint256[] r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }

    function decodeParamOp(uint256 x) internal pure returns (uint8 b) {
        return uint8(x >> (8 * 30));
    }

    function decodeParamId(uint256 x) internal pure returns (uint8 b) {
        return uint8(x >> (8 * 31));
    }

    function decodeParamsList(uint256 x) internal pure returns (uint32 a, uint32 b, uint32 c) {
        a = uint32(x);
        b = uint32(x >> (8 * 4));
        c = uint32(x >> (8 * 8));
    }
}
