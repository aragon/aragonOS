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

    function arr(address a) internal view returns (uint256[] r) {
        return arr(uint256(a));
    }

    function arr(uint256 a, uint256 b) internal view returns (uint256[] r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }
}
