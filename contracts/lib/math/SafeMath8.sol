// See https://github.com/OpenZeppelin/openzeppelin-solidity/blob/d51e38758e1d985661534534d5c61e27bece5042/contracts/math/SafeMath.sol
// Adapted for uint8, pragma ^0.4.24, and satisfying our linter rules
// Also optimized the mul() implementation, see https://github.com/aragon/aragonOS/pull/417

pragma solidity ^0.4.24;


/**
 * @title SafeMath8
 * @dev Math operations for uint8 with safety checks that revert on error
 */
library SafeMath8 {
    string private constant ERROR_ADD_OVERFLOW = "MATH8_ADD_OVERFLOW";
    string private constant ERROR_SUB_UNDERFLOW = "MATH8_SUB_UNDERFLOW";
    string private constant ERROR_MUL_OVERFLOW = "MATH8_MUL_OVERFLOW";
    string private constant ERROR_DIV_ZERO = "MATH8_DIV_ZERO";

    /**
    * @dev Multiplies two numbers, reverts on overflow.
    */
    function mul(uint8 _a, uint8 _b) internal pure returns (uint8) {
        uint256 c = uint256(_a) * uint256(_b);
        require(c < 256, ERROR_MUL_OVERFLOW);

        return uint8(c);
    }

    /**
    * @dev Integer division of two numbers truncating the quotient, reverts on division by zero.
    */
    function div(uint8 _a, uint8 _b) internal pure returns (uint8) {
        require(_b > 0, ERROR_DIV_ZERO); // Solidity only automatically asserts when dividing by 0
        uint8 c = _a / _b;
        // assert(_a == _b * c + _a % _b); // There is no case in which this doesn't hold

        return c;
    }

    /**
    * @dev Subtracts two numbers, reverts on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint8 _a, uint8 _b) internal pure returns (uint8) {
        require(_b <= _a, ERROR_SUB_UNDERFLOW);
        uint8 c = _a - _b;

        return c;
    }

    /**
    * @dev Adds two numbers, reverts on overflow.
    */
    function add(uint8 _a, uint8 _b) internal pure returns (uint8) {
        uint8 c = _a + _b;
        require(c >= _a, ERROR_ADD_OVERFLOW);

        return c;
    }

    /**
    * @dev Divides two numbers and returns the remainder (unsigned integer modulo),
    * reverts when dividing by zero.
    */
    function mod(uint8 a, uint8 b) internal pure returns (uint8) {
        require(b != 0, ERROR_DIV_ZERO);
        return a % b;
    }
}
