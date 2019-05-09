pragma solidity ^0.4.24;

import "../../../../lib/sig/ECDSA.sol";


contract ECDSAMock {
  using ECDSA for bytes32;

  function recover(bytes32 hash, bytes signature) public pure returns (address) {
    return hash.toEthSignedMessageHash().recover(signature);
  }
}
