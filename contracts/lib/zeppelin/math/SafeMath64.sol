pragma solidity ^0.4.11;


/**
 * @title SafeMath64
 * @dev Math operations for uint64 with safety checks that throw on error
 */
library SafeMath64 {
  function mul(uint64 a, uint64 b) internal pure returns (uint64) {
    uint64 c = a * b;
    require(a == 0 || c / a == b);
    return c;
  }

  function div(uint64 a, uint64 b) internal pure returns (uint64) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint64 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  function sub(uint64 a, uint64 b) internal pure returns (uint64) {
    require(b <= a);
    return a - b;
  }

  function add(uint64 a, uint64 b) internal pure returns (uint64) {
    uint64 c = a + b;
    require(c >= a);
    return c;
  }
}
