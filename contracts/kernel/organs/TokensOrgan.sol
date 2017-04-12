pragma solidity ^0.4.8;

import "./MetaOrgan.sol";

contract TokensOrgan is MetaOrgan {
  function addToken(address token) {
    governanceTokens.push(token);
  }

  function removeToken(address token) {
    int256 i = indexOf(token);
    if (i < 0) throw;

    if (governanceTokens.length > 1) {
      // Move last element to the place of the removing item
      governanceTokens[uint256(i)] = governanceTokens[governanceTokens.length - 1];
    }
    // Remove last item
    governanceTokens.length -= 1;
  }

  function canHandlePayload(bytes payload) returns (bool) {
    bytes4 sig = getFunctionSignature(payload);
    return
      sig == 0x6070372c || // addToken(address)
      sig == 0x6c1521ca;   // removeToken(address)
  }

  function indexOf(address _t) internal returns (int256) {
    for (uint256 i = 0; i < governanceTokens.length; i++) {
      if (governanceTokens[i] == _t) return int256(i);
    }
    return -1;
  }

  address[] public governanceTokens;
}
