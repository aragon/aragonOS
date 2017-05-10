pragma solidity ^0.4.11;

import "./MetaOrgan.sol";

contract TokensOrgan is MetaOrgan {
  function addToken(address token) {
    governanceTokens.push(token);
  }

  function removeToken(address token) {
    int256 i = indexOf(token);
    if (i < 0) throw;

    if (getTokenCount() > 1) {
      // Move last element to the place of the removing item
      governanceTokens[uint256(i)] = governanceTokens[governanceTokens.length - 1];
    }
    // Remove last item
    governanceTokens.length -= 1;
  }

  function getToken(uint i) returns (address) {
    return governanceTokens[i];
  }

  function getTokenCount() returns (uint) {
    return governanceTokens.length;
  }

  function canHandlePayload(bytes payload) returns (bool) {
    bytes4 sig = getFunctionSignature(payload);
    return
      sig == 0xd48bfca7 || // addToken(address)
      sig == 0x5fa7b584;   // removeToken(address)
      // TODO: getToken and count
  }

  function indexOf(address _t) internal returns (int256) {
    for (uint256 i = 0; i < governanceTokens.length; i++) {
      if (governanceTokens[i] == _t) return int256(i);
    }
    return -1;
  }

  address[] public governanceTokens;
}
