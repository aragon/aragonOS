pragma solidity 0.4.24;

import "../../../../lib/math/SafeMath8.sol";


contract SafeMath8Mock {
    using SafeMath8 for uint8;

    function mulExt(uint8 _a, uint8 _b) public pure returns (uint8) {
        return _a.mul(_b);
    }

    function divExt(uint8 _a, uint8 _b) public pure returns (uint8) {
        return _a.div(_b);
    }

    function subExt(uint8 _a, uint8 _b) public pure returns (uint8) {
        return _a.sub(_b);
    }

    function addExt(uint8 _a, uint8 _b) public pure returns (uint8) {
        return _a.add(_b);
    }

    function modExt(uint8 _a, uint8 _b) public pure returns (uint8) {
        return _a.mod(_b);
    }
}
