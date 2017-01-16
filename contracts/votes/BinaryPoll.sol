pragma solidity ^0.4.8;

import "./BinaryVoting.sol";
import "../AbstractCompany.sol";

contract BinaryPoll is BinaryVoting("Yes", "No") {
  string public description;
  function BinaryPoll(string _description, uint8 _percentage) {
    // Metadata
    description = _description;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    super.executeOnAppove(company);
  }
}
