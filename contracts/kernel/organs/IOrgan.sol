pragma solidity ^0.4.11;

import "../../dao/DAOStorage.sol";

contract IOrgan is DAOStorage {
  function getFunctionSignature(bytes _d) public constant returns (bytes4 sig) {
    assembly { sig := mload(add(_d, 0x20)) }
  }
}
