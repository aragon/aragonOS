pragma solidity ^0.4.8;

import "zeppelin/token/VestedToken.sol";
import "./GovernanceToken.sol";

// transferrableTokens is called from governance to vested
contract Stock is VestedToken, GovernanceToken {
  /*
  uint public decimals = 0;
  address public parentToken = 0x0;
  */

  function transferableTokens(address holder, uint64 time) constant public returns (uint256) {
    return min256(VestedToken.transferableTokens(holder, time), GovernanceToken.transferableTokens(holder, time));
  }
}
