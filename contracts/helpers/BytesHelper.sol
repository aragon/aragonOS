pragma solidity ^0.4.8;

library BytesHelper {
  function toBytes4(bytes self) returns (bytes4 b) {
    uint l = 4;
    for (uint x = 0; x < l; x++) {
      b = bytes4(uint(b) + uint(uint(self[x]) * (2 ** (8 * (l - 1 - x)))));
    }
  }

  function toBytes32(string self, uint startIndex) returns (bytes32 b) {
    uint l = 32;
    bytes memory bs = toBytes(self, startIndex, l);

    for (uint x = 0; x < l; x++) {
        b = bytes32(uint(b) + uint(uint(bs[x]) * (2 ** (8 * (l - 1 - x)))));
    }
  }

  function toBytes(string self, uint startIndex, uint length) internal returns (bytes) {
    bytes memory str = bytes(self);
    bytes memory bs = new bytes(length);
    uint maxIndex = ((str.length - startIndex) < (length * 2) ? (str.length - startIndex) : startIndex + (length * 2));

    for (uint i = startIndex; i < maxIndex; i++) {
      uint ii = i - startIndex;
      bs[ii / 2] = byte(uint8(bs[ii / 2]) + (uint8(toByte(str[i])) * uint8(16 ** (1 - (ii % 2)))));
    }

    return bs;
  }

  function toASCIIString(address self) internal returns (string) {
    return toASCIIString(uint(self), 20);
  }

  function toASCIIString(uint self, uint length) internal returns (string) {
    bytes memory s = new bytes(length * 2);
    for (uint i = 0; i < length; i++) {
      byte b = byte(uint8(uint(self) / (2**(8*(length - 1 - i)))));
      byte hi = byte(uint8(b) / 16);
      byte lo = byte(uint8(b) - 16 * uint8(hi));
      s[2*i] = toChar(hi);
      s[2*i+1] = toChar(lo);
    }

    return string(s);
  }

  function toChar(byte b) returns (byte c) {
    if (b < 10) return byte(uint8(b) + 0x30);
    else return byte(uint8(b) + 0x57);
  }

  function toByte(byte char) returns (byte c) {
    if (uint8(char) > 0x57) return byte(uint8(char) - 0x57);
    else return byte(uint8(char) - 0x30);
  }
}
