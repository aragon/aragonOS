pragma solidity ^0.4.8;

import "./BinaryVoting.sol";
import "../helpers/BytesHelper.sol";

contract GenericBinaryVoting is BinaryVoting("Approve", "Reject") {
  using BytesHelper for bytes;

  bytes public data;

  function GenericBinaryVoting(bytes _data, uint64 closingTime, address _company, bytes32 r, bytes32 s, uint8 v, uint nonce) {
    data = _data;
    if (_company != 0x0) beginPoll(AbstractCompany(_company), closingTime, r, s, v, nonce);
  }

  function beginPoll(AbstractCompany company, uint64 closingTime, bytes32 r, bytes32 s, uint8 v, uint nonce) private {
    company.beginUntrustedPoll(address(this), closingTime, msg.sender, r, s, v, nonce);
  }

  function mainSignature() public constant returns (bytes4) {
    return data.toBytes4();
  }

  function executeOnAppove(AbstractCompany company) {
    if (!company.call(data)) throw;
  }
}
