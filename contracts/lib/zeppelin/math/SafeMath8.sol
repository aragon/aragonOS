// See https://github.com/OpenZeppelin/openzeppelin-solidity/blob/40b5594f52fce22f6c9190e8e45ccb3cab624783/contracts/math/SafeMath.sol
// Adapted for uint8, pragma ^0.4.18, using `require()`, and satisfying our linter rules

pragma solidity ^0.4.18;


/**
 * @title SafeMath8
 * @dev Math operations for uint8 with safety checks that throw on error
 */
library SafeMath8 {

    /**
    * @dev Multiplies two numbers, throws on overflow.
    */
    function mul(uint8 a, uint8 b) internal pure returns (uint8 c) {
        // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        c = a * b;
        require(c / a == b);
        return c;
    }

    /**
    * @dev Integer division of two numbers, truncating the quotient.
    */
    function div(uint8 a, uint8 b) internal pure returns (uint8) {
        // uint8 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        require(b > 0); // Solidity automatically asserts when dividing by 0
        return a / b;
    }

    /**
    * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint8 a, uint8 b) internal pure returns (uint8) {
        require(b <= a);
        return a - b;
    }

    /**
    * @dev Adds two numbers, throws on overflow.
    */
    function add(uint8 a, uint8 b) internal pure returns (uint8 c) {
        c = a + b;
        require(c >= a);
        return c;
    }
}
