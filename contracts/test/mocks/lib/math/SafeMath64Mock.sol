pragma solidity 0.4.24;

import "../../../../lib/math/SafeMath64.sol";


contract SafeMath64Mock {
    using SafeMath64 for uint64;

    function mulExt(uint64 _a, uint64 _b) public pure returns (uint64) {
        return _a.mul(_b);
    }

    function divExt(uint64 _a, uint64 _b) public pure returns (uint64) {
        return _a.div(_b);
    }

    function subExt(uint64 _a, uint64 _b) public pure returns (uint64) {
        return _a.sub(_b);
    }

    function addExt(uint64 _a, uint64 _b) public pure returns (uint64) {
        return _a.add(_b);
    }

    function modExt(uint64 _a, uint64 _b) public pure returns (uint64) {
        return _a.mod(_b);
    }
}
