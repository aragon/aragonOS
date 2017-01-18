pragma solidity ^0.4.8;

import "./BinaryVoting.sol";

contract GenericBinaryVoting is BinaryVoting("Approve", "Reject") {
  bytes public data;

  function GenericBinaryVoting(string _signature, bytes _data) {
    mainSignature = _signature; // TODO: When transition is over, wont be needed (extract first bytes4)
    data = _data;
  }

  function executeOnAppove(AbstractCompany company) internal {
    if (!company.call(data)) throw;
    super.executeOnAppove(company);
  }
}
