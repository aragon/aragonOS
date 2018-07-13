// See https://github.com/OpenZeppelin/openzeppelin-solidity/blob/40b5594f52fce22f6c9190e8e45ccb3cab624783/contracts/math/SafeMath.sol
// Adapted for uint64, pragma ^0.4.18, and satisfying our linter rules

pragma solidity ^0.4.18;


/**
 * @title SafeMath64
 * @dev Math operations for uint64 with safety checks that throw on error
 */
library SafeMath64 {

    /**
    * @dev Multiplies two numbers, throws on overflow.
    */
    function mul(uint64 a, uint64 b) internal pure returns (uint64 c) {
        // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        c = a * b;
        assert(c / a == b);
        return c;
    }

    /**
    * @dev Integer division of two numbers, truncating the quotient.
    */
    function div(uint64 a, uint64 b) internal pure returns (uint64) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        // uint64 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return a / b;
    }

    /**
    * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint64 a, uint64 b) internal pure returns (uint64) {
        assert(b <= a);
        return a - b;
    }

    /**
    * @dev Adds two numbers, throws on overflow.
    */
    function add(uint64 a, uint64 b) internal pure returns (uint64 c) {
        c = a + b;
        assert(c >= a);
        return c;
    }
}
