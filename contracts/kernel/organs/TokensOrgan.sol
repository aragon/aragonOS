pragma solidity ^0.4.11;

import "./Organ.sol";

contract TokensOrgan is Organ {
  function addToken(address token) {
    uint tokenId = getTokenCount();
    storageSet(getStorageKeyForToken(tokenId), uint256(token));
    setTokenCount(tokenId + 1);
  }

  function removeToken(address token) {
    int256 i = indexOf(token);
    require(i >= 0);

    if (getTokenCount() > 1) {
      // Move last element to the place of the removing item
      storageSet(getStorageKeyForToken(uint256(i)), uint256(getToken(getTokenCount() - 1)));
    }
    // Remove last item
    setTokenCount(getTokenCount() - 1);
  }

  function getToken(uint i) returns (address) {
    return address(storageGet(getStorageKeyForToken(i)));
  }

  function getStorageKeyForToken(uint tokenId) constant internal returns (bytes32) {
    return sha3(0x03, 0x00, tokenId);
  }

  function getTokenCount() returns (uint) {
    return storageGet(sha3(0x03, 0x01));
  }

  function setTokenCount(uint _count) internal {
    storageSet(sha3(0x03, 0x01), _count);
  }

  function canHandlePayload(bytes payload) returns (bool) {
    bytes4 sig = getFunctionSignature(payload);
    return
      sig == 0xd48bfca7 ||   // addToken(address)
      sig == 0x5fa7b584 ||   // removeToken(address)
      sig == 0xe4b50cb8 ||   // getToken(uint256)
      sig == 0x78a89567;     // getTokenCount()
  }

  function indexOf(address _t) internal returns (int256) {
    uint count = getTokenCount();
    for (uint256 i = 0; i < count; i++) {
      if (getToken(i) == _t) return int256(i);
    }
    return -1;
  }
}
