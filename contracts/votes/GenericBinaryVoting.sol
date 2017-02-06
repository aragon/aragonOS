pragma solidity ^0.4.8;

import "./BinaryVoting.sol";
import "../helpers/BytesHelper.sol";

contract GenericBinaryVoting is BinaryVoting("Approve", "Reject") {
  using BytesHelper for bytes;

  bytes public data;

  function GenericBinaryVoting(bytes _data) {
    data = _data;
  }

  function mainSignature() public constant returns (bytes4) {
    return data.toBytes4();
  }

  function executeOnAppove(AbstractCompany company) internal {
    if (!company.call(data)) throw;
    super.executeOnAppove(company);
  }
}
