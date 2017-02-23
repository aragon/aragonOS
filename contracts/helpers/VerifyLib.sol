pragma solidity ^0.4.8;

library VerifyLib {
  function verify(address _addr, bytes _verifiedCode) returns (bool) {
    bytes memory code = codeAt(_addr);

    if (code.length != _verifiedCode.length) return false;

    for (uint i = 0; i < code.length; i++) {
      if (code[i] != _verifiedCode[i]) return false;
    }

    return true;
  }

  function codeAt(address _addr) internal returns (bytes memory o_code) {
    assembly {
      // retrieve the size of the code, this needs assembly
      let size := extcodesize(_addr)
      // allocate output byte array - this could also be done without assembly
      // by using o_code = new bytes(size)
      o_code := mload(0x40)
      // new "memory end" including padding
      mstore(0x40, add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f))))
      // store length in memory
      mstore(o_code, size)
      // actually retrieve the code, this needs assembly
      extcodecopy(_addr, add(o_code, 0x20), 0, size)
    }
  }
}
